import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { voicePlugin } from "@dsh-forge-creator/plugin-creator-voice";
import {
  runContractSuite,
  type ToolContext,
} from "@dsh-forge-creator/core";
import type { VoiceReference } from "../src/types.js";

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), "dsh-voice-"));
});

afterAll(() => {
  rmSync(workspaceRoot, { recursive: true, force: true });
});

const ctx = (approved = true): ToolContext => ({
  workspaceRoot,
  run: async () => {
    throw new Error("no binary expected for creator-voice");
  },
  permission: approved ? { approved: true } : undefined,
});

const tool = (name: string) =>
  voicePlugin.tools.find((t) => t.name === name)!;

const authorized = {
  name: "My Own Voice",
  source: "synthetic fixture",
  owner: "me",
  authorization: true,
  authorizationNote: "own recording",
};

describe("voice_register_reference (CREATOR-010)", () => {
  it("registers a reference with authorization:true and stores required metadata", async () => {
    const res = await tool("voice_register_reference").execute(
      { ...authorized },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const ref = JSON.parse(res.raw!) as VoiceReference;
    expect(ref.authorizationNote).toBe("own recording");
    expect(ref.checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(ref.createdAt).toBeTruthy();
    expect(ref.id).toMatch(/^voice-/);
  });

  it("rejects authorization=false", async () => {
    const res = await tool("voice_register_reference").execute(
      { ...authorized, authorization: false },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
    expect(res.error?.message).toMatch(/authorization/i);
  });

  it("rejects a missing authorization field", async () => {
    const { authorization, ...rest } = authorized;
    const res = await tool("voice_register_reference").execute(rest, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });

  it("rejects empty name/source/owner", async () => {
    const res = await tool("voice_register_reference").execute(
      { ...authorized, name: "" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("InvalidArguments");
  });
});

describe("voice_list (CREATOR-010)", () => {
  it("lists registered references with no biometric data", async () => {
    await tool("voice_register_reference").execute(
      { ...authorized, name: "Listed Voice" },
      ctx(),
    );
    const res = await tool("voice_list").execute({}, ctx());
    expect(res.ok).toBe(true);
    const list = JSON.parse(res.raw!) as VoiceReference[];
    expect(list.length).toBeGreaterThan(0);
    for (const ref of list) {
      expect(ref).not.toHaveProperty("biometrics");
      expect(ref).not.toHaveProperty("embedding");
    }
  });
});

describe("tts_generate (CREATOR-010)", () => {
  it("generates TTS with the default synthetic voice", async () => {
    const res = await tool("tts_generate").execute(
      { text: "Hello", outputPath: "hello.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.raw!).path).toBe("hello.wav");
  });

  it("rejects TTS for a voice with no authorized reference (no impersonation bypass)", async () => {
    const res = await tool("tts_generate").execute(
      { text: "Hi", voice: "Some Celebrity", outputPath: "c.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("allows TTS for a registered authorized reference", async () => {
    const reg = await tool("voice_register_reference").execute(
      { ...authorized, name: "TTS Voice" },
      ctx(),
    );
    const ref = JSON.parse(reg.raw!) as VoiceReference;
    const res = await tool("tts_generate").execute(
      { text: "Hi", voice: ref.id, outputPath: "t.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
  });

  it("rejects an output path outside the workspace", async () => {
    const res = await tool("tts_generate").execute(
      { text: "Hi", outputPath: "../out.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("WorkspaceViolation");
  });
});

describe("voice_clone / voice_style_transfer (CREATOR-010)", () => {
  it("clones only from an authorized reference", async () => {
    const reg = await tool("voice_register_reference").execute(
      { ...authorized, name: "Clone Voice" },
      ctx(),
    );
    const ref = JSON.parse(reg.raw!) as VoiceReference;
    const res = await tool("voice_clone").execute(
      { referenceId: ref.id, outputPath: "clone.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
  });

  it("rejects cloning a celebrity/person name that has no authorized reference", async () => {
    const res = await tool("voice_clone").execute(
      { referenceId: "Some Celebrity", outputPath: "clone2.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("CREATOR_VOICE_AUTHORIZATION_REQUIRED");
  });

  it("rejects style transfer from an unauthorized reference", async () => {
    const res = await tool("voice_style_transfer").execute(
      { referenceId: "Nobody Registered", style: "calm", outputPath: "s.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(false);
  });

  it("performs style transfer from an authorized reference", async () => {
    const reg = await tool("voice_register_reference").execute(
      { ...authorized, name: "Style Voice" },
      ctx(),
    );
    const ref = JSON.parse(reg.raw!) as VoiceReference;
    const res = await tool("voice_style_transfer").execute(
      { referenceId: ref.id, style: "calm", outputPath: "st.wav", provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
  });
});

describe("voice_preview (CREATOR-010)", () => {
  it("previews an authorized reference with a local path (no external URL)", async () => {
    const reg = await tool("voice_register_reference").execute(
      { ...authorized, name: "Preview Voice" },
      ctx(),
    );
    const ref = JSON.parse(reg.raw!) as VoiceReference;
    const res = await tool("voice_preview").execute(
      { referenceId: ref.id, provider: "mock" },
      ctx(),
    );
    expect(res.ok).toBe(true);
    expect(res.raw).not.toMatch(/https?:\/\//);
  });

  it("redacts secret provider keys from registered metadata output", async () => {
    const res = await tool("voice_register_reference").execute(
      {
        ...authorized,
        name: "Secret Voice",
        source: "https://user:supersecret@host/voice.wav",
      },
      ctx(),
    );
    expect(res.ok).toBe(true);
    const raw = res.raw ?? "";
    expect(raw).not.toContain("supersecret");
    expect(raw).toContain("***@");
  });
});

describe("contract suite (CREATOR-010)", () => {
  it("passes the shared plugin contract kit", async () => {
    const report = await runContractSuite(voicePlugin, {
      workspaceRoot,
      toolArgs: {
        voice_register_reference: {
          valid: { ...authorized },
          invalid: { ...authorized, authorization: "yes" },
        },
        voice_list: {
          valid: {},
          invalid: { foo: 1 },
        },
        tts_generate: {
          valid: { text: "Hi", outputPath: "o.wav", provider: "mock" },
          invalid: { text: 42 },
        },
        voice_clone: {
          valid: { referenceId: "voice-1", outputPath: "c.wav", provider: "mock" },
          invalid: {},
        },
        voice_style_transfer: {
          valid: { referenceId: "voice-1", style: "calm", outputPath: "s.wav", provider: "mock" },
          invalid: {},
        },
        voice_preview: {
          valid: { referenceId: "voice-1", provider: "mock" },
          invalid: {},
        },
      },
    });
    if (!report.passed) {
      const failed = report.checks.filter((c) => !c.passed);
      expect(
        report.passed,
        "failed checks:\n" +
          failed.map((c) => `- ${c.name} :: ${c.detail ?? ""}`).join("\n"),
      ).toBe(true);
    } else {
      expect(report.passed).toBe(true);
    }
  });
});
