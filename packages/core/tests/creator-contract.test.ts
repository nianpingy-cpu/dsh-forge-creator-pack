import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { expectTypeOf } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateCreatorAsset,
  validateRights,
  validatePlatformPostDraft,
  validatePublishResult,
  serializeCredentialRef,
  sanitizeCredentialText,
  normalizeCreatorError,
  providerSupports,
  RIGHTS_STATUSES,
  PUBLISH_STATUSES,
  CREATOR_ERROR_CODES,
  type CreatorAsset,
  type RightsMetadata,
  type CredentialRef,
  type PlatformPostDraft,
  type PublishResult,
  type CreatorProvider,
} from "../src/creator/index.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-creator-contract-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const baseAsset: CreatorAsset = {
  id: "asset-1",
  path: "media/a.mp4",
  type: "video",
  checksum: "abc123",
};

/** Narrow a validation result to its errors; throws when it is unexpectedly valid. */
function errorsOf(
  r: { ok: false; errors: string[] } | { ok: true },
): string[] {
  if (r.ok) throw new Error("expected validation to fail");
  return r.errors;
}

describe("CreatorAsset validation (CREATOR-002)", () => {
  it("accepts a valid asset inside the workspace", () => {
    const r = validateCreatorAsset(baseAsset, workspaceRoot);
    expect(r.ok).toBe(true);
  });

  it("rejects an asset whose path escapes the workspace", () => {
    const bad = { ...baseAsset, path: "../outside.mp4" };
    const r = validateCreatorAsset(bad, workspaceRoot);
    expect(r.ok).toBe(false);
    expect(errorsOf(r).join("\n")).toContain("workspace");
  });

  it("rejects an absolute path outside the workspace", () => {
    const outside = join(workspaceRoot, "..", "elsewhere.mp4");
    const bad = { ...baseAsset, path: outside };
    const r = validateCreatorAsset(bad, workspaceRoot);
    expect(r.ok).toBe(false);
  });

  it("rejects an empty checksum", () => {
    const bad = { ...baseAsset, checksum: "   " };
    const r = validateCreatorAsset(bad, workspaceRoot);
    expect(r.ok).toBe(false);
    expect(errorsOf(r).join("\n")).toContain("checksum");
  });

  it("rejects an unknown asset type", () => {
    const bad = { ...baseAsset, type: "banana" as CreatorAsset["type"] };
    const r = validateCreatorAsset(bad, workspaceRoot);
    expect(r.ok).toBe(false);
  });
});

describe("RightsMetadata (CREATOR-002)", () => {
  it("expresses every allowed rights status", () => {
    expect(RIGHTS_STATUSES).toEqual([
      "owned",
      "licensed",
      "public-domain",
      "permission-confirmed",
      "unknown",
    ]);
    for (const status of RIGHTS_STATUSES) {
      const rights: RightsMetadata = {
        status: status as RightsMetadata["status"],
      };
      expect(validateRights(rights).ok).toBe(true);
    }
  });

  it("rejects an invalid rights status", () => {
    const r = validateRights({
      status: "stolen" as RightsMetadata["status"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("CredentialRef (CREATOR-002)", () => {
  it("never carries a secret value field (type-level)", () => {
    expectTypeOf<CredentialRef>().not.toHaveProperty("secret");
    expectTypeOf<CredentialRef>().not.toHaveProperty("value");
    expectTypeOf<CredentialRef>().not.toHaveProperty("token");
    expectTypeOf<CredentialRef>().not.toHaveProperty("apiKey");
  });

  it("serializes only provider + key — no secret field", () => {
    const ref: CredentialRef = { provider: "postiz", key: "main-account" };
    const serialized = serializeCredentialRef(ref);
    expect(serialized).toContain("provider");
    expect(serialized).toContain("key");
    expect(serialized).not.toContain("secret");
    expect(JSON.parse(serialized)).toEqual({
      provider: "postiz",
      key: "main-account",
    });
  });

  it("drops any secret field smuggled in at runtime", () => {
    const smuggled = {
      provider: "postiz",
      key: "main",
      secret: "super-secret-123",
    } as unknown as CredentialRef;
    const serialized = serializeCredentialRef(smuggled);
    expect(serialized).not.toContain("super-secret-123");
    expect(JSON.parse(serialized)).toEqual({ provider: "postiz", key: "main" });
  });
});

describe("PlatformPostDraft (CREATOR-002)", () => {
  it("accepts a valid draft", () => {
    const draft: PlatformPostDraft = { platform: "bilibili", media: [baseAsset] };
    expect(validatePlatformPostDraft(draft, workspaceRoot).ok).toBe(true);
  });

  it("rejects media referencing an invalid asset", () => {
    const bad: PlatformPostDraft = {
      platform: "bilibili",
      media: [{ ...baseAsset, checksum: "" }],
    };
    const r = validatePlatformPostDraft(bad, workspaceRoot);
    expect(r.ok).toBe(false);
    expect(errorsOf(r).join("\n")).toContain("media");
  });

  it("accepts a draft with no media (text-only post)", () => {
    // Spec only requires media elements (when present) to be valid assets.
    const r = validatePlatformPostDraft(
      { platform: "x", media: [], text: "hello" },
      workspaceRoot,
    );
    expect(r.ok).toBe(true);
  });
});

describe("PublishResult (CREATOR-002)", () => {
  it("controls the status enum", () => {
    expect(PUBLISH_STATUSES).toEqual([
      "draft",
      "scheduled",
      "published",
      "failed",
    ]);
    for (const status of PUBLISH_STATUSES) {
      expect(
        validatePublishResult({
          platform: "x",
          status: status as PublishResult["status"],
        }).ok,
      ).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    const r = validatePublishResult({
      platform: "x",
      status: "pwned" as PublishResult["status"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("credential redaction (CREATOR-002)", () => {
  it("redacts known secrets from model-visible text", () => {
    const text = "connecting with token sk-abcdef now";
    const cleaned = sanitizeCredentialText(text, ["sk-abcdef"]);
    expect(cleaned).not.toContain("sk-abcdef");
    expect(cleaned).toContain("[REDACTED]");
  });
});

describe("normalized creator errors (CREATOR-002)", () => {
  it("never exposes a raw stack trace and stays on the controlled code set", () => {
    const err = normalizeCreatorError(
      new Error("boom\n    at file.ts:1:1"),
      "creator operation failed",
    );
    expect(err.message).not.toContain("at file.ts");
    expect(CREATOR_ERROR_CODES).toContain(err.code);
  });

  it("passes through a known creator error code", () => {
    const err = normalizeCreatorError({
      code: "CREATOR_INVALID_ASSET",
      message: "bad asset",
    });
    expect(err.code).toBe("CREATOR_INVALID_ASSET");
  });
});

describe("provider base contract (CREATOR-002)", () => {
  it("reports capability support from the provider declaration", () => {
    const provider = {
      name: "mock-radar",
      capabilities: ["fetch", "search", "score"],
    };
    expect(providerSupports(provider, "fetch")).toBe(true);
    expect(providerSupports(provider, "publish")).toBe(false);
  });
});

describe("validator hardening (external review findings)", () => {
  it("never throws on null/malformed assets — returns typed errors", () => {
    expect(() =>
      validateCreatorAsset(null as unknown as CreatorAsset, workspaceRoot),
    ).not.toThrow();
    const r = validateCreatorAsset(
      null as unknown as CreatorAsset,
      workspaceRoot,
    );
    expect(r.ok).toBe(false);
  });

  it("never throws when draft media contains a malformed element", () => {
    expect(() =>
      validatePlatformPostDraft(
        {
          platform: "x",
          media: [null as unknown as CreatorAsset],
        },
        workspaceRoot,
      ),
    ).not.toThrow();
    const r = validatePlatformPostDraft(
      { platform: "x", media: [null as unknown as CreatorAsset] },
      workspaceRoot,
    );
    expect(r.ok).toBe(false);
    expect(errorsOf(r).join("\n")).toContain("media");
  });

  it("never throws on null CredentialRef — serializes an empty reference", () => {
    expect(() =>
      serializeCredentialRef(null as unknown as CredentialRef),
    ).not.toThrow();
    const serialized = serializeCredentialRef(null as unknown as CredentialRef);
    expect(JSON.parse(serialized)).toEqual({ provider: "", key: "" });
  });

  it("never throws on a null provider — reports no support", () => {
    expect(() =>
      providerSupports(null as unknown as CreatorProvider, "fetch"),
    ).not.toThrow();
    expect(providerSupports(null as unknown as CreatorProvider, "fetch")).toBe(
      false,
    );
  });

  it("drops every secret-like smuggled field, not just `secret`", () => {
    for (const field of ["token", "apiKey", "value", "Authorization"]) {
      const smuggled = {
        provider: "postiz",
        key: "main",
        [field]: "super-secret-123",
      } as unknown as CredentialRef;
      const serialized = serializeCredentialRef(smuggled);
      expect(serialized).not.toContain("super-secret-123");
    }
  });

  it("sanitizes known-code error messages that contain stack frames", () => {
    const err = normalizeCreatorError({
      code: "CREATOR_INVALID_ASSET",
      message: "boom\n    at provider.ts:1:1",
    });
    expect(err.message).not.toContain("at provider.ts");
    expect(err.code).toBe("CREATOR_INVALID_ASSET");
  });

  it("preserves structured context on known-code errors", () => {
    const err = normalizeCreatorError({
      code: "CREATOR_PROVIDER_TIMEOUT",
      message: "timed out",
      context: { timeoutMs: 5000 },
    });
    expect(err.context).toEqual({ timeoutMs: 5000 });
  });
});
