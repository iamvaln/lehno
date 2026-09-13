import { createHmac, timingSafeEqual } from "node:crypto";
import { Body, Controller, Headers, HttpCode, Inject, Logger, Post, Req } from "@nestjs/common";
import type { TypeClient } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { VersionsService } from "./versions.service.js";

/* THE EAS WEBHOOK — a release registers itself.
 *
 * Nobody should have to type a command after shipping. EAS knows the build
 * number AT THE MOMENT it produces it, so it is EAS that announces it, and the
 * registry fills up before the store submission even happens. That is exactly
 * the order the spec asks for — register BEFORE submitting — and the only way
 * to guarantee it is to stop relying on a human gesture.
 *
 * THIS WEBHOOK NEVER SETS `forcesUpdate`. Forcing an update takes every older
 * device out of service: that is a human decision, made while looking at how
 * many people it evicts. No naming convention and no commit message should ever
 * be able to trigger it.
 *
 * Wired up on the Expo side with:
 *   eas webhook:create --event BUILD --url https://…/v1/public/eas/build
 */

/* THE SIGNATURE IS THE ONLY THING GUARDING THIS PATH.
 *
 * It is public — EAS calls from its own servers, with no token and no client
 * pair. Anyone can POST to it, and without a signature anyone could register a
 * version, or retire one.
 *
 * EAS signs the RAW body with HMAC-SHA1 using the secret given to
 * `eas webhook:create --secret`, and puts it in `expo-signature`, shaped
 * `sha1=<hex>`.
 */
const SIGNATURE_HEADER = "expo-signature";

@Controller("public/eas")
export class EasController {
  private readonly log = new Logger("eas-webhook");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(VersionsService) private readonly versions: VersionsService,
  ) {}

  /* 204: there is nothing to hand back to EAS, and handing it something would
     invite it to read it. We acknowledge, that is all. */
  @Post("build")
  @HttpCode(204)
  async build(
    @Headers(SIGNATURE_HEADER) signature: string | undefined,
    @Req() req: { rawBody?: Buffer },
    @Body() body: unknown,
  ): Promise<void> {
    const secret = process.env["EAS_WEBHOOK_SECRET"];

    /* WITH NO SECRET CONFIGURED, THE PATH CLOSES. It does not stay open "for
       now": an unsigned webhook is a write form left open on the version
       registry. */
    if (secret === undefined || secret === "") {
      this.log.warn("EAS webhook called while no secret is configured");
      throw new AppError("not_found", "resource not found");
    }

    if (!signatureMatches(signature, req.rawBody, secret)) {
      /* `not_found` AND NOT `forbidden`: a 403 would confirm that the path
         exists and that only the signature was missing. A webhook path tells
         nothing about itself to whoever lacks the secret. */
      this.log.warn("EAS webhook: invalid signature");
      throw new AppError("not_found", "resource not found");
    }

    const announcement = readAnnouncement(body);
    if (announcement === null) {
      /* We still acknowledge: otherwise EAS would retry forever over a payload
         we will never learn to read. It is logged so the reader can be fixed. */
      this.log.warn(`EAS webhook: unreadable payload — ${outline(body)}`);
      return;
    }

    /* WE ONLY REGISTER WHAT SUCCEEDED. A failed build produced no binary:
       registering it would create a version nobody can install, and that
       version would then become the target every "please update" points at. */
    if (announcement.status !== "finished") {
      this.log.log(`EAS webhook: build ${announcement.status}, nothing to register`);
      return;
    }

    /* ONLY THE PRODUCTION PROFILE ENTERS THE REGISTRY.
     *
     * A webhook fires on EVERY build — `development` and `preview` included,
     * and those are the ones we run most often. Registering one would make it
     * the newest non-retired build, therefore the target `exiger()` points at:
     * the day the version guard is switched on, everyone would get a 426
     * sending them to a binary nobody can install.
     *
     * AN ABSENT PROFILE REGISTERS NOTHING EITHER. That is the safe side of the
     * trade: a shape change then freezes the registry, which someone notices
     * at the next release, instead of quietly promoting a dev build. The log
     * line says which of the two happened. */
    if (announcement.profile === null) {
      this.log.warn(
        `EAS webhook: no build profile in the payload, nothing registered — ${outline(body)}`,
      );
      return;
    }
    if (announcement.profile !== "production") {
      this.log.log(`EAS webhook: ${announcement.profile} build, nothing to register`);
      return;
    }

    /* THE STORE LINK CARRIES OVER FROM THE PREVIOUS RELEASE. EAS does not know
       it — it builds, it does not publish. Carrying it over keeps an
       auto-registered version from landing without a link, which would make a
       426 say "please update" without saying where to go. */
    const previous = await this.prisma.appVersion.findFirst({
      where: { platform: announcement.platform as never, storeUrl: { not: null } },
      orderBy: { buildNumber: "desc" },
      select: { storeUrl: true },
    });

    const row = await this.prisma.appVersion.upsert({
      where: {
        platform_buildNumber: {
          platform: announcement.platform as never, buildNumber: announcement.build,
        },
      },
      create: {
        platform: announcement.platform as never,
        version: announcement.version,
        buildNumber: announcement.build,
        /* NEVER `forcesUpdate` HERE. See the file header: it is a human
           decision, made in the admin panel while seeing how many devices it
           would evict. */
        ...(previous?.storeUrl ? { storeUrl: previous.storeUrl } : {}),
        ...(announcement.notes === null ? {} : { notes: announcement.notes }),
      },
      /* REPLAYABLE: EAS may repeat a call, and a pipeline may rerun a step. We
         refresh the version label, never the flag nor the retirement — those
         belong to the admin panel, and silently undoing them would cancel a
         human decision without anyone knowing why old devices came back. */
      update: {
        version: announcement.version,
        ...(announcement.notes === null ? {} : { notes: announcement.notes }),
      },
    });

    this.versions.oublier(announcement.platform);
    this.log.log(
      `EAS webhook: registered ${row.platform} ${row.version} build ${row.buildNumber}`,
    );
  }
}

type Announcement = {
  platform: TypeClient;
  version: string;
  build: number;
  status: string;
  profile: string | null;
  notes: string | null;
};

/* READING IS DEFENSIVE, AND THAT IS DELIBERATE.
 *
 * The webhook shape belongs to Expo: it may gain fields, rename them, move
 * them. We pull out the four we need, tolerate everything else, and return
 * `null` rather than throw when one is missing — a webhook that fails makes EAS
 * retry in a loop, which turns a format change into a request storm.
 *
 * `appBuildVersion` is a STRING on Expo's side, including on Android where it
 * is an integer: we convert here, and anything non-integer counts as
 * unreadable. */
function readAnnouncement(body: unknown): Announcement | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const platform = toPlatform(b["platform"]);
  const version = text(b["appVersion"]);
  const build = positiveInteger(b["appBuildVersion"]);
  const status = text(b["status"]);
  if (platform === null || version === null || build === null || status === null) return null;

  /* THE PROFILE DECIDES WHETHER WE REGISTER AT ALL — see the guard in the
     handler. Expo carries it under `metadata`; the top-level read is there
     because a null profile means "register nothing", so a field that merely
     moved would silently freeze the registry. */
  const metadata = (typeof b["metadata"] === "object" && b["metadata"] !== null
    ? b["metadata"]
    : {}) as Record<string, unknown>;

  return {
    platform,
    version,
    build,
    status,
    profile: text(metadata["buildProfile"]) ?? text(b["buildProfile"]),
    /* Enough to find the build again in Expo's dashboard the day someone asks
       where a version came from. */
    notes: text(b["buildDetailsPageUrl"]),
  };
}

/* `ios` and `android` on Expo's side; `mobile_ios` and `mobile_android` on
   ours. The mapping lives HERE, at the boundary, and nowhere else. */
function toPlatform(raw: unknown): TypeClient | null {
  const v = text(raw)?.toLowerCase();
  if (v === "ios") return "mobile_ios";
  if (v === "android") return "mobile_android";
  return null;
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function positiveInteger(v: unknown): number | null {
  const raw = typeof v === "number" ? String(v) : text(v);
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

/* Enough to diagnose a format change, not enough to copy a whole payload into
   the log. */
function outline(body: unknown): string {
  try {
    if (typeof body !== "object" || body === null) return typeof body;
    return `keys: ${Object.keys(body as object).slice(0, 12).join(", ")}`;
  } catch {
    return "unreadable";
  }
}

/* ON THE BYTES WE RECEIVED, never on re-serialised JSON.
 *
 * EAS signs what it sends. Re-serialising the parsed payload would be a gamble:
 * spacing, key order, one character escaped differently are enough to change
 * the digest — and a webhook that rejects a legitimate payload makes EAS retry
 * in a loop. `main.ts` therefore keeps the bytes as the parser sees them, and
 * those are what we verify.
 *
 * IN CONSTANT TIME, like an API client key: comparing two signatures with `===`
 * stops at the first differing byte, and the response time then tells the
 * caller how many bytes were right. */
function signatureMatches(
  header: string | undefined,
  raw: Buffer | undefined,
  secret: string,
): boolean {
  if (header === undefined || raw === undefined) return false;

  const expected = createHmac("sha1", secret).update(raw).digest("hex");
  const received = header.startsWith("sha1=") ? header.slice(5) : header;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
