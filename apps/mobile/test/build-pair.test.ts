import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

/**
 * THE CLIENT PAIR MUST FOLLOW THE PLATFORM BEING BUILT.
 *
 * EAS environment variables are scoped per ENVIRONMENT — production, preview,
 * development — never per platform. A single `LEHNO_CLIENT_ID` in production
 * would therefore hand the Android pair to an iOS build, and the server would
 * see a `mobile_ios` presenting a pair registered as `mobile_android`: that is
 * `type_discordant`, and every iPhone would be refused the day the guard is
 * switched on.
 *
 * AN ABSENT PAIR BEATS A WRONG ONE. A build with no pair is merely
 * unidentified; a build carrying the other platform's pair LIES about what it
 * is — the very incident this whole mechanism exists to catch.
 */
describe("the client pair carried by a build", () => {
  const require_ = createRequire(import.meta.url);
  const CONFIG = require_.resolve("../app.config.js");

  const VARIABLES = [
    "EAS_BUILD_PLATFORM",
    "LEHNO_CLIENT_ID", "LEHNO_CLIENT_KEY",
    "LEHNO_CLIENT_ID_IOS", "LEHNO_CLIENT_KEY_IOS",
    "LEHNO_CLIENT_ID_ANDROID", "LEHNO_CLIENT_KEY_ANDROID",
  ];

  let previous: Record<string, string | undefined>;

  beforeEach(() => {
    previous = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
    for (const v of VARIABLES) delete process.env[v];
  });

  afterEach(() => {
    for (const [v, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[v];
      else process.env[v] = value;
    }
  });

  /** The config is read fresh: it captures the platform at module load. */
  const extra = (env: Record<string, string>): Record<string, unknown> => {
    Object.assign(process.env, env);
    delete require_.cache[CONFIG];
    const build = require_(CONFIG) as (a: { config: object }) => { extra: Record<string, unknown> };
    return build({ config: {} }).extra;
  };

  it("gives an Android build the Android pair", () => {
    expect(extra({
      EAS_BUILD_PLATFORM: "android",
      LEHNO_CLIENT_ID_ANDROID: "mobile_android_prod_x",
      LEHNO_CLIENT_KEY_ANDROID: "android-key",
      LEHNO_CLIENT_ID_IOS: "mobile_ios_prod_y",
      LEHNO_CLIENT_KEY_IOS: "ios-key",
    })).toMatchObject({ clientId: "mobile_android_prod_x", clientKey: "android-key" });
  });

  it("gives an iOS build the iOS pair", () => {
    expect(extra({
      EAS_BUILD_PLATFORM: "ios",
      LEHNO_CLIENT_ID_ANDROID: "mobile_android_prod_x",
      LEHNO_CLIENT_KEY_ANDROID: "android-key",
      LEHNO_CLIENT_ID_IOS: "mobile_ios_prod_y",
      LEHNO_CLIENT_KEY_IOS: "ios-key",
    })).toMatchObject({ clientId: "mobile_ios_prod_y", clientKey: "ios-key" });
  });

  /* THE CASE THAT MATTERS. Only the Android pair is configured — as it is
     today. An iOS build must go out unidentified rather than wearing it. */
  it("leaves a build unidentified rather than lending it the other platform's pair", () => {
    expect(extra({
      EAS_BUILD_PLATFORM: "ios",
      LEHNO_CLIENT_ID: "mobile_android_prod_x",
      LEHNO_CLIENT_KEY: "android-key",
      LEHNO_CLIENT_ID_ANDROID: "mobile_android_prod_x",
      LEHNO_CLIENT_KEY_ANDROID: "android-key",
    })).toMatchObject({ clientId: null, clientKey: null });
  });

  /* Off EAS — a developer's machine — the bare names are the ones that exist,
     and they are read as they are. */
  it("reads the bare names when no build platform is set", () => {
    expect(extra({
      LEHNO_CLIENT_ID: "mobile_android_staging_z",
      LEHNO_CLIENT_KEY: "local-key",
    })).toMatchObject({ clientId: "mobile_android_staging_z", clientKey: "local-key" });
  });

  it("carries nothing when nothing is configured", () => {
    expect(extra({})).toMatchObject({ clientId: null, clientKey: null });
  });
});
