import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createApproval,
  assertCreatorApproval,
  assertCreatorAssetInWorkspace,
  assertRightsPolicy,
  assertVoiceAuthorization,
  assertNoBypassFlags,
  assertNoCredentialPlaintext,
  redactForLogger,
  assertWithinResourceLimits,
  safetyError,
  DEFAULT_NETWORK_TIMEOUT_MS,
  DEFAULT_MAX_MEDIA_FILE_SIZE_BYTES,
  DEFAULT_MAX_BATCH_ITEMS,
  CREATOR_MUTATION_CLASSES,
  type CreatorAsset,
  type CreatorError,
} from "../src/creator/index.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-creator-safety-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

/** Assert that fn throws a CreatorError with the given code. */
function expectCreatorThrow(fn: () => void, code: CreatorError["code"]): void {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, `expected throw with code ${code}`).toBeDefined();
  const err = caught as CreatorError;
  expect(err.code).toBe(code);
}

const asset: CreatorAsset = {
  id: "a",
  path: "media/a.mp4",
  type: "video",
  checksum: "x",
};

describe("approval gate (CREATOR-003)", () => {
  it("rejects publish without approval", () => {
    expectCreatorThrow(
      () =>
        assertCreatorApproval(undefined, "creator-remote-publish", "hash-1"),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("rejects schedule without approval", () => {
    expectCreatorThrow(
      () =>
        assertCreatorApproval(undefined, "creator-remote-publish", "hash-1"),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("rejects deleting a remote schedule without approval", () => {
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          undefined,
          "creator-remote-destructive",
          "hash-1",
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("accepts a valid in-scope approval bound to the content hash", () => {
    const approval = createApproval("creator-remote-publish", "hash-1");
    expect(() =>
      assertCreatorApproval(
        approval,
        "creator-remote-publish",
        "hash-1",
        approval.expiresAt - 1,
      ),
    ).not.toThrow();
  });

  it("rejects an expired approval", () => {
    const approval = createApproval("creator-remote-publish", "hash-1", {
      ttlMs: 1000,
    });
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          approval,
          "creator-remote-publish",
          "hash-1",
          approval.expiresAt + 1,
        ),
      "CREATOR_APPROVAL_EXPIRED",
    );
  });

  it("rejects an approval bound to a different content hash", () => {
    const approval = createApproval("creator-remote-publish", "hash-1");
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          approval,
          "creator-remote-publish",
          "hash-2",
          approval.expiresAt - 1,
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });
});

describe("credential safety (CREATOR-003)", () => {
  it("rejects a result carrying a credential in plaintext", () => {
    expectCreatorThrow(
      () =>
        assertNoCredentialPlaintext(
          { url: "https://x.example/media?token=sk-abc" },
          ["sk-abc"],
        ),
      "CREATOR_CREDENTIAL_LEAK",
    );
  });

  it("allows results without credentials", () => {
    expect(() =>
      assertNoCredentialPlaintext({ url: "https://x.example/media" }, [
        "sk-abc",
      ]),
    ).not.toThrow();
  });

  it("redacts credentials before logging", () => {
    const out = redactForLogger("connecting with token sk-abc now", ["sk-abc"]);
    expect(out).not.toContain("sk-abc");
    expect(out).toContain("[REDACTED]");
  });
});

describe("workspace boundary (CREATOR-003)", () => {
  it("rejects an asset outside the workspace", () => {
    const bad = { ...asset, path: "../outside.mp4" };
    expectCreatorThrow(
      () => assertCreatorAssetInWorkspace(bad, workspaceRoot),
      "CREATOR_OUTPUT_OUTSIDE_WORKSPACE",
    );
  });

  it("accepts an asset inside the workspace", () => {
    expect(() => assertCreatorAssetInWorkspace(asset, workspaceRoot)).not.toThrow();
  });
});

describe("rights policy (CREATOR-003)", () => {
  it("rejects unknown-rights download under strict policy", () => {
    expectCreatorThrow(
      () => assertRightsPolicy(undefined, "strict"),
      "CREATOR_RIGHTS_REQUIRED",
    );
    expectCreatorThrow(
      () => assertRightsPolicy({ status: "unknown" }, "strict"),
      "CREATOR_RIGHTS_REQUIRED",
    );
  });

  it("allows explicit rights under strict policy", () => {
    expect(() =>
      assertRightsPolicy({ status: "owned" }, "strict"),
    ).not.toThrow();
    expect(() =>
      assertRightsPolicy({ status: "licensed" }, "strict"),
    ).not.toThrow();
  });
});

describe("voice authorization (CREATOR-003)", () => {
  it("rejects voice clone without authorization", () => {
    expectCreatorThrow(
      () => assertVoiceAuthorization(undefined),
      "CREATOR_VOICE_AUTHORIZATION_REQUIRED",
    );
    expectCreatorThrow(
      () => assertVoiceAuthorization({ authorized: false }),
      "CREATOR_VOICE_AUTHORIZATION_REQUIRED",
    );
  });

  it("allows an authorized voice clone", () => {
    expect(() =>
      assertVoiceAuthorization({
        authorized: true,
        authorizationNote: "own voice, recorded consent",
      }),
    ).not.toThrow();
  });
});

describe("bypass flags (CREATOR-003)", () => {
  it("rejects DRM / CAPTCHA-bypass / anti-detection flags", () => {
    for (const key of [
      "drmBypass",
      "captchaBypass",
      "antiDetection",
      "browserFingerprintSpoof",
    ]) {
      expectCreatorThrow(
        () => assertNoBypassFlags({ [key]: true }),
        "CREATOR_UNSUPPORTED_CAPABILITY",
      );
    }
  });

  it("allows clean options", () => {
    expect(() => assertNoBypassFlags({ format: "mp4" })).not.toThrow();
  });
});

describe("resource limits (CREATOR-003)", () => {
  it("enforces the max media file size default", () => {
    expectCreatorThrow(
      () =>
        assertWithinResourceLimits({
          sizeBytes: DEFAULT_MAX_MEDIA_FILE_SIZE_BYTES + 1,
        }),
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
    );
  });

  it("allows inputs within the limits", () => {
    expect(() =>
      assertWithinResourceLimits({
        sizeBytes: 1024,
        timeoutMs: DEFAULT_NETWORK_TIMEOUT_MS,
        batchItems: 10,
      }),
    ).not.toThrow();
  });
});

describe("safety primitives (CREATOR-003)", () => {
  it("exposes the creator mutation classes", () => {
    expect(CREATOR_MUTATION_CLASSES).toContain("creator-remote-publish");
    expect(CREATOR_MUTATION_CLASSES).toContain("creator-voice-sensitive");
  });

  it("builds typed creator safety errors", () => {
    const err = safetyError(
      "CREATOR_APPROVAL_REQUIRED",
      "approval needed for remote publish",
    );
    expect(err.code).toBe("CREATOR_APPROVAL_REQUIRED");
    expect(err.message).toContain("approval");
  });
});

describe("safety hardening (external review findings)", () => {
  it("rejects an approval that does not cover the requested scope", () => {
    const approval = createApproval("creator-remote-draft", "hash-1");
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          approval,
          "creator-remote-publish",
          "hash-1",
          approval.expiresAt - 1,
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("does not let a draft-scope approval authorize a schedule/publish", () => {
    const draftApproval = createApproval("creator-remote-draft", "hash-1");
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          draftApproval,
          "creator-remote-publish",
          "hash-1",
          draftApproval.expiresAt - 1,
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("lets an 'all' approval cover ordinary remote mutations", () => {
    const approval = createApproval("all", "hash-1");
    expect(() =>
      assertCreatorApproval(
        approval,
        "creator-remote-publish",
        "hash-1",
        approval.expiresAt - 1,
      ),
    ).not.toThrow();
  });

  it("does not let an 'all' approval cover destructive or voice-sensitive mutations", () => {
    const approval = createApproval("all", "hash-1");
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          approval,
          "creator-remote-destructive",
          "hash-1",
          approval.expiresAt - 1,
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
    expectCreatorThrow(
      () =>
        assertCreatorApproval(
          approval,
          "creator-voice-sensitive",
          "hash-1",
          approval.expiresAt - 1,
        ),
      "CREATOR_APPROVAL_REQUIRED",
    );
  });

  it("never throws on non-JSON-serializable results when scanning for credentials", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => assertNoCredentialPlaintext(circular, ["sk-abc"])).not.toThrow();
    expect(() =>
      assertNoCredentialPlaintext({ big: 10n }, ["sk-abc"]),
    ).not.toThrow();
    expect(() => assertNoCredentialPlaintext(undefined, ["sk-abc"])).not.toThrow();
  });

  it("returns the canonical workspace path for an in-workspace asset", () => {
    const canonical = assertCreatorAssetInWorkspace(asset, workspaceRoot);
    expect(typeof canonical).toBe("string");
    expect(canonical.length).toBeGreaterThan(0);
  });

  it("rejects nested and kebab-case bypass flags", () => {
    expectCreatorThrow(
      () => assertNoBypassFlags({ download: { drmBypass: true } }),
      "CREATOR_UNSUPPORTED_CAPABILITY",
    );
    expectCreatorThrow(
      () => assertNoBypassFlags({ "drm-bypass": true }),
      "CREATOR_UNSUPPORTED_CAPABILITY",
    );
  });

  it("rejects a non-boolean truthy authorization value", () => {
    expectCreatorThrow(
      () =>
        assertVoiceAuthorization({
          authorized: "yes" as unknown as boolean,
        }),
      "CREATOR_VOICE_AUTHORIZATION_REQUIRED",
    );
  });

  it("allows unknown rights under permissive policy", () => {
    expect(() => assertRightsPolicy(undefined, "permissive")).not.toThrow();
    expect(() =>
      assertRightsPolicy({ status: "unknown" }, "permissive"),
    ).not.toThrow();
  });

  it("enforces timeout and batch limits individually", () => {
    expectCreatorThrow(
      () =>
        assertWithinResourceLimits({
          timeoutMs: DEFAULT_NETWORK_TIMEOUT_MS + 1,
        }),
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
    );
    expectCreatorThrow(
      () =>
        assertWithinResourceLimits({
          batchItems: DEFAULT_MAX_BATCH_ITEMS + 1,
        }),
      "CREATOR_RESOURCE_LIMIT_EXCEEDED",
    );
  });

  it("handles empty secret lists and empty text for log redaction", () => {
    expect(redactForLogger("no secrets here", [])).toBe("no secrets here");
    expect(redactForLogger("", ["sk-abc"])).toBe("");
  });
});
