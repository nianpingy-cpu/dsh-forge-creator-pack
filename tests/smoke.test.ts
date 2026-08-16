import { describe, expect, it } from "vitest";
import { CORE_VERSION } from "@dsh-forge-creator/core";

describe("workspace smoke", () => {
  it("resolves the adapted core package and exports its version", () => {
    expect(CORE_VERSION).toBe("0.1.0");
  });
});
