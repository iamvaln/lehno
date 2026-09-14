import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EasController } from "../src/clients/eas.controller.js";
import { VersionsService } from "../src/clients/versions.service.js";

/**
 * A RELEASE REGISTERS ITSELF.
 *
 * Nobody should have to type a command after shipping: EAS knows the build
 * number at the moment it produces it, and it is EAS that announces it. The
 * registry therefore fills up BEFORE the store submission — the order the spec
 * asks for, and one only a webhook can guarantee.
 *
 * THE SIGNATURE IS THE ONLY THING GUARDING THIS PATH. It is public, with no
 * token and no client pair: without it, anyone could register a version.
 */
describe("the EAS webhook", () => {
  let db: TestDb;
  let controller: EasController;

  const SECRET = "a-webhook-secret-for-the-tests";

  const payload = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
    platform: "ios",
    appVersion: "1.4.2",
    appBuildVersion: "412",
    status: "finished",
    metadata: { buildProfile: "production" },
    buildDetailsPageUrl: "https://expo.dev/accounts/lehno/builds/abc",
    ...fields,
  });

  /** What EAS sends: the bytes, and their digest. */
  const signed = (body: Record<string, unknown>, secret = SECRET) => {
    const raw = Buffer.from(JSON.stringify(body), "utf8");
    return {
      body,
      req: { rawBody: raw },
      signature: `sha1=${createHmac("sha1", secret).update(raw).digest("hex")}`,
    };
  };

  const call = async (
    body: Record<string, unknown>,
    options: { secret?: string; signature?: string; withoutRawBody?: boolean } = {},
  ): Promise<void> => {
    const sent = signed(body, options.secret ?? SECRET);
    await controller.build(
      options.signature ?? sent.signature,
      options.withoutRawBody ? {} : sent.req,
      sent.body,
    );
  };

  const registered = async () =>
    db.prisma.appVersion.findMany({ orderBy: { buildNumber: "desc" } });

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    process.env["EAS_WEBHOOK_SECRET"] = SECRET;
    controller = new EasController(db.prisma as never, new VersionsService(db.prisma as never));
  });

  it("registers the version EAS announces", async () => {
    await call(payload());

    const [row] = await registered();
    expect(row).toMatchObject({ platform: "mobile_ios", version: "1.4.2", buildNumber: 412 });
  });

  /* `ios` ON EXPO'S SIDE, `mobile_ios` ON OURS. The mapping lives at the
     boundary and nowhere else — without this case, a mistranslated platform
     would read as unknown and nothing would register, silently. */
  it("maps Expo's platform onto ours", async () => {
    await call(payload({ platform: "android", appBuildVersion: "77" }));
    expect((await registered())[0]).toMatchObject({ platform: "mobile_android" });
  });

  /* IT NEVER SETS `forcesUpdate`. Forcing an update takes every older device
     out of service: a human decision, made in the admin panel while seeing how
     many people it evicts. No automation may trigger it — this is THE case that
     matters in this file. */
  it("never forces an update", async () => {
    await call(payload({ forcesUpdate: true, metadata: { buildProfile: "production" } }));
    expect((await registered())[0]?.forcesUpdate).toBe(false);
  });

  /* WE ONLY REGISTER WHAT SUCCEEDED. A failed build produced no binary:
     registering it would create a version nobody can install, and that version
     would become the target every "please update" points at. */
  it("ignores a build that did not finish", async () => {
    for (const status of ["errored", "canceled", "in-queue", "in-progress"]) {
      await call(payload({ status }));
    }
    expect(await registered()).toHaveLength(0);
  });

  /* ONLY THE PRODUCTION PROFILE ENTERS THE REGISTRY. The webhook fires on every
     build, and `development` is the one we run most often — the repo's only
     build scripts are `eas build --profile development`. A dev build in the
     registry becomes the newest non-retired build, so the target `exiger()`
     points at: a 426 sending everyone to a binary nobody can install. */
  describe("the build profile", () => {
    it("ignores every profile but production", async () => {
      for (const buildProfile of ["development", "preview", "simulator"]) {
        await call(payload({ metadata: { buildProfile } }));
      }
      expect(await registered()).toHaveLength(0);
    });

    /* AN ABSENT PROFILE REGISTERS NOTHING EITHER — the safe side of the trade.
       A shape change freezes the registry, which someone notices at the next
       release, instead of quietly promoting a dev build. */
    it("registers nothing when the payload carries no profile", async () => {
      await call(payload({ metadata: {} }));
      expect(await registered()).toHaveLength(0);
    });

    /* The field is read at the top level too: a profile that merely MOVED would
       otherwise read as absent and freeze the registry silently. */
    it("still reads a profile that moved to the top level", async () => {
      await call(payload({ metadata: {}, buildProfile: "production" }));
      expect(await registered()).toHaveLength(1);
    });
  });

  describe("the signature", () => {
    /* WITHOUT IT, THIS PATH IS A WRITE FORM left open on the version registry.
       It is the only thing guarding it. */
    it("rejects a wrong signature, and registers nothing", async () => {
      await expect(call(payload(), { signature: "sha1=0000" }))
        .rejects.toMatchObject({ code: "not_found" });
      expect(await registered()).toHaveLength(0);
    });

    it("rejects a payload signed with another secret", async () => {
      await expect(call(payload(), { secret: "some-other-secret" }))
        .rejects.toMatchObject({ code: "not_found" });
      expect(await registered()).toHaveLength(0);
    });

    /* `not_found` AND NOT `forbidden`: a 403 would confirm the path exists and
       that only the signature was missing. A webhook path tells nothing about
       itself to whoever lacks the secret. */
    it("does not reveal that the path exists", async () => {
      await expect(call(payload(), { signature: "sha1=0000" }))
        .rejects.toMatchObject({ code: "not_found" });
    });

    /* WITH NO SECRET CONFIGURED, THE PATH CLOSES. It does not stay open "for
       now" — an unsigned webhook is an open door. */
    it("closes when no secret is configured", async () => {
      delete process.env["EAS_WEBHOOK_SECRET"];
      await expect(call(payload())).rejects.toMatchObject({ code: "not_found" });
      expect(await registered()).toHaveLength(0);
    });

    /* IT IS CHECKED ON THE BYTES RECEIVED, never on re-serialised JSON. With no
       raw body we refuse rather than re-serialise: spacing or key order would
       be enough to fail a legitimate payload, and EAS would retry in a loop. */
    it("refuses when the received bytes were not kept", async () => {
      await expect(call(payload(), { withoutRawBody: true }))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("what it tolerates", () => {
    /* AN UNREADABLE PAYLOAD IS NOT AN ERROR. The shape belongs to Expo: it may
       change. Throwing would make EAS retry indefinitely, turning a format
       change into a request storm. */
    it("acknowledges a payload it cannot read", async () => {
      await expect(call({ something: "unexpected", andMore: true })).resolves.toBeUndefined();
      expect(await registered()).toHaveLength(0);
    });

    it("ignores a build number that is not an integer", async () => {
      await call(payload({ appBuildVersion: "1.4.2" }));
      expect(await registered()).toHaveLength(0);
    });
  });

  /* THE SHAPE EAS ACTUALLY SENDS — and it is not the one the first version
     read. Its root carries `id`, `platform`, `status`, `artifacts`, `metadata`,
     `metrics`; everything describing the version sits inside `metadata`. A real
     production build went through on 2026-09-13, registered nothing, and left
     only `unreadable payload` in the log. These cases are that payload. */
  describe("the payload EAS really sends", () => {
    const real = (fields: Record<string, unknown> = {}): Record<string, unknown> => ({
      id: "3b97408a-de89-452e-b7f1-a61f40915ed8",
      appId: "fdd049d8-8fd6-48a7-b366-56f580e8d39e",
      platform: "android",
      status: "finished",
      artifacts: { buildUrl: "https://expo.dev/artifacts/eas/abc.aab" },
      metadata: {
        appName: "Lehno",
        appVersion: "0.1.0",
        appBuildVersion: "3",
        buildProfile: "production",
        appIdentifier: "com.lehno.app",
        distribution: "store",
      },
      metrics: {},
      error: null,
      createdAt: "2026-09-13T11:10:44.028Z",
      ...fields,
    });

    it("registers the build it announces", async () => {
      await call(real());

      expect((await registered())[0]).toMatchObject({
        platform: "mobile_android", version: "0.1.0", buildNumber: 3, forcesUpdate: false,
      });
    });

    it("keeps where the build can be found again", async () => {
      await call(real());
      expect((await registered())[0]?.notes).toBe("https://expo.dev/artifacts/eas/abc.aab");
    });

    /* THE PROFILE IS IN `metadata` TOO. Read at the root only, it would come
       back null — and a null profile registers nothing, so every release would
       silently stop appearing. */
    it("still refuses a development build", async () => {
      await call(real({
        metadata: { appVersion: "0.1.0", appBuildVersion: "4", buildProfile: "development" },
      }));
      expect(await registered()).toHaveLength(0);
    });

    /* THE CLI SHOUTS, THE WEBHOOK WHISPERS: `FINISHED` against `finished`.
       Comparing raw would hinge the registry on which one Expo sends. */
    it("reads a status whatever its case", async () => {
      await call(real({ status: "FINISHED", platform: "ANDROID" }));
      expect((await registered())[0]).toMatchObject({ platform: "mobile_android", buildNumber: 3 });
    });

    it("falls back to the build id when no artifact link is given", async () => {
      await call(real({ artifacts: {} }));
      expect((await registered())[0]?.notes)
        .toBe("https://expo.dev/builds/3b97408a-de89-452e-b7f1-a61f40915ed8");
    });
  });

  /* REPLAYABLE: EAS may repeat a call, and a pipeline may rerun a step. A
     duplicate must neither fail nor create a second row. */
  it("replays without creating a duplicate", async () => {
    await call(payload());
    await call(payload({ appVersion: "1.4.3" }));

    const rows = await registered();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.version).toBe("1.4.3");
  });

  /* AND IT DOES NOT UNDO WHAT THE ADMIN PANEL SET. A replay that reset
     `forcesUpdate` to false would silently cancel a human decision — and nobody
     would know why the old devices came back. */
  it("does not undo a flag set in the admin panel", async () => {
    await call(payload());
    await db.prisma.appVersion.updateMany({
      where: { buildNumber: 412 }, data: { forcesUpdate: true, isRetired: true },
    });

    await call(payload({ appVersion: "1.4.4" }));

    const [row] = await registered();
    expect(row).toMatchObject({ forcesUpdate: true, isRetired: true, version: "1.4.4" });
  });

  /* THE STORE LINK CARRIES OVER FROM THE PREVIOUS RELEASE. EAS does not know it
     — it builds, it does not publish. Without this, an auto-registered version
     would land without a link, and a 426 would say "please update" without
     saying where to go. */
  it("carries the store link over from the previous release", async () => {
    await db.prisma.appVersion.create({
      data: {
        platform: "mobile_ios" as never, version: "1.4.1",
        buildNumber: 411, storeUrl: "https://apps.apple.com/lehno",
      },
    });

    await call(payload());

    expect((await registered())[0]?.storeUrl).toBe("https://apps.apple.com/lehno");
  });
});
