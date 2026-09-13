import { describe, expect, it } from "vitest";
import { clientHeaders, clientType, osHeader, type BuildIdentity } from "../lib/client.js";

const identity = (over: Partial<BuildIdentity> = {}): BuildIdentity => ({
  clientId: "lehno-mobile",
  clientKey: "k-123",
  version: "1.4.2",
  build: "412",
  os: "ios",
  osVersion: "17.4",
  env: "prod",
  ...over,
});

describe("the client type the server compares", () => {
  it("is lowercase, because that is what the contract declares", () => {
    expect(clientType("ios")).toBe("mobile_ios");
    expect(clientType("android")).toBe("mobile_android");
  });
});

describe("the OS header", () => {
  it("joins platform and version", () => {
    expect(osHeader("ios", "17.4")).toBe("ios:17.4");
  });

  /* Android reports an API LEVEL as a number. Left unstringified it would break
     template interpolation silently on the day the platform returns 0. */
  it("stringifies an Android API level", () => {
    expect(osHeader("android", 34)).toBe("android:34");
  });
});

describe("what the headers carry", () => {
  it("sends all six when the build knows itself", () => {
    expect(Object.keys(clientHeaders(identity())).sort()).toEqual([
      "x-app-build", "x-app-env", "x-app-os", "x-app-version",
      "x-client-id", "x-client-key", "x-client-type",
    ]);
  });

  /* WHAT IS UNKNOWN IS NOT SENT. An empty header claims a value that does not
     exist; the registry already reads an absent build as "cannot be compared". */
  it("omits the build rather than sending it empty", () => {
    const headers = clientHeaders(identity({ build: null }));
    expect(headers).not.toHaveProperty("x-app-build");
  });

  it("omits the credentials a local run does not have", () => {
    const headers = clientHeaders(identity({ clientId: null, clientKey: null }));
    expect(headers).not.toHaveProperty("x-client-id");
    expect(headers).not.toHaveProperty("x-client-key");
  });

  /* These three never depend on the build: a call must always say what kind of
     client it is, on which system, in which environment. */
  it("always says the type, the system and the environment", () => {
    const headers = clientHeaders(identity({
      clientId: null, clientKey: null, version: null, build: null,
    }));
    expect(headers).toEqual({
      "x-client-type": "mobile_ios",
      "x-app-os": "ios:17.4",
      "x-app-env": "prod",
    });
  });
});
