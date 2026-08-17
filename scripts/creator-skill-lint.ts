/**
 * Creator Pack skill lint (CREATOR-014).
 *
 * Distinguish Tool from Skill: plugins define what a tool CAN do; skills
 * define HOW to make content well. Every skill under `skills/creator/*.md`
 * MUST:
 *   - have a purpose description (## Purpose)
 *   - include the eight required sections (Trigger, Inputs, Workflow, Tool
 *     preference, Quality checklist, Platform constraints, Failure /
 *     uncertainty handling, Do-not-do rules)
 *   - reference only REGISTERED creator/ffmpeg tool names
 *   - NOT bypass the publish approval flow
 *   - NOT require the model to read secrets directly
 *   - NOT promise guaranteed traffic / virality (heuristic strategies only)
 *
 * Wired into the CI `creator-contract` job (same pattern as
 * `creator-ecosystem-check.ts`).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS_DIR = join(ROOT, "skills", "creator");

/** The eight required sections (keyword match on the heading, case-insensitive). */
export const REQUIRED_SECTIONS: readonly string[] = [
  "trigger",
  "inputs",
  "workflow",
  "tool preference",
  "quality checklist",
  "platform constraints",
  "failure",
  "do-not-do",
];

/** Every registered creator / ffmpeg tool name that skills may reference. */
export const REGISTERED_TOOLS: readonly string[] = [
  // creator-radar
  "trend_sources", "trend_fetch", "trend_search", "topic_score", "topic_compare",
  "topic_history", "topic_velocity", "competitor_watch", "opportunity_rank",
  // creator-capture
  "media_inspect", "media_formats", "media_download", "audio_download",
  "subtitle_download", "thumbnail_download", "playlist_inspect", "playlist_download",
  // creator-transcribe
  "transcribe_media", "transcribe_segments", "transcribe_words", "subtitle_srt",
  "subtitle_vtt", "subtitle_ass", "chapter_detect", "language_detect", "transcript_export",
  // creator-clips
  "clip_by_time", "clip_by_chapter", "clip_by_transcript", "remove_silence",
  "make_vertical", "make_square", "batch_clip", "merge_segments",
  // creator-short-video
  "short_video_plan", "short_video_generate", "short_video_status",
  "short_video_assets", "short_video_preview",
  // creator-cover
  "cover_generate_background", "cover_layout", "cover_add_title", "cover_add_subject",
  "cover_resize", "cover_variants", "cover_validate",
  // creator-voice
  "voice_register_reference", "voice_list", "tts_generate", "voice_clone",
  "voice_style_transfer", "voice_preview",
  // creator-localize
  "subtitle_translate", "subtitle_align", "subtitle_resegment", "localize_video",
  "dub_video", "localize_preview",
  // creator-motion
  "motion_templates", "motion_inspect_template", "motion_render",
  "motion_render_variants", "motion_preview",
  // creator-publish
  "publisher_accounts", "publisher_capabilities", "post_validate", "post_preview",
  "post_create_draft", "post_schedule", "post_publish", "post_status",
  "post_cancel_schedule",
  // ffmpeg adapter
  "media_probe", "video_clip", "video_transcode", "video_concat", "audio_extract",
  "audio_convert", "thumbnail_generate", "media_compress", "video_vertical",
  "video_square", "silence_remove",
];

const TOOL_NAME_RE = /`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g;

interface ForbiddenRule {
  name: string;
  re: RegExp;
  message: string;
}

/** Rules that must never appear in a skill's guidance text. */
const FORBIDDEN_RULES: readonly ForbiddenRule[] = [
  {
    name: "approval-bypass",
    re: /(bypass|skip|avoid|ignore).{0,24}(approval|publish\s+approval|approval\s+flow)/i,
    message: "must not bypass the publish approval flow",
  },
  {
    name: "secret-read",
    re: /(read|echo|print|expose|paste).{0,24}(api[_-]?key|secret|token|password|credential)/i,
    message: "must not require the model to read secrets directly",
  },
  {
    name: "guaranteed-traffic",
    re: /(guarantee[d]?|definitely|100%|will\s+surely|promise).{0,24}(traffic|viral|go\s+viral|views|followers|爆款|涨粉|必火|流量)/i,
    message: "must not promise guaranteed traffic/virality (heuristic strategies only)",
  },
];

export interface SkillFinding {
  file: string;
  rule: string;
  message: string;
}

export interface SkillLintResult {
  ok: boolean;
  findings: SkillFinding[];
}

/** Extract backtick-delimited snake_case identifiers that look like tool calls. */
function extractToolRefs(content: string): string[] {
  const refs: string[] = [];
  for (const m of content.matchAll(TOOL_NAME_RE)) {
    refs.push(m[1]!);
  }
  return refs;
}

function headingSections(content: string): string[] {
  const headings: string[] = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^#+\s+(.+)$/);
    if (m) headings.push(m[1]!.toLowerCase());
  }
  return headings;
}

/** Lint a single skill markdown file. */
export function lintSkillFile(absolutePath: string, displayName?: string): SkillLintResult {
  const findings: SkillFinding[] = [];
  const name = displayName ?? absolutePath;
  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    return { ok: false, findings: [{ file: name, rule: "read", message: "could not read skill file" }] };
  }
  // Normalize CRLF -> LF so `^...$` heading/line anchors match on Windows.
  content = content.replace(/\r\n/g, "\n");

  const headings = headingSections(content);

  // 1. purpose description required (exact heading, not a title containing the word).
  if (!headings.some((h) => h.trim() === "purpose")) {
    findings.push({ file: name, rule: "purpose", message: "must have a ## Purpose description" });
  }

  // 2. required sections.
  for (const section of REQUIRED_SECTIONS) {
    if (!headings.some((h) => h.includes(section))) {
      findings.push({ file: name, rule: "section", message: `missing required section "${section}"` });
    }
  }

  // 3. only registered tool names.
  const registered = new Set(REGISTERED_TOOLS);
  for (const ref of extractToolRefs(content)) {
    if (!registered.has(ref)) {
      findings.push({ file: name, rule: "unregistered-tool", message: `references unregistered tool "${ref}"` });
    }
  }

  // 4. forbidden guidance (approval bypass / secret read / guaranteed traffic).
  for (const rule of FORBIDDEN_RULES) {
    if (rule.re.test(content)) {
      findings.push({ file: name, rule: rule.name, message: rule.message });
    }
  }

  return { ok: findings.length === 0, findings };
}

/** Lint every skill under skills/creator/*.md. */
export function lintAllSkills(): SkillLintResult {
  const findings: SkillFinding[] = [];
  const files = readdirSync(SKILLS_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    return { ok: false, findings: [{ file: SKILLS_DIR, rule: "empty", message: "no skill files found" }] };
  }
  for (const file of files) {
    const result = lintSkillFile(join(SKILLS_DIR, file), file);
    findings.push(...result.findings);
  }
  return { ok: findings.length === 0, findings };
}

// Run directly: `node scripts/creator-skill-lint.ts`
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? "");
if (isMain) {
  const result = lintAllSkills();
  for (const f of result.findings) {
    console.error(`[skill-lint] ${f.file} :: ${f.rule} :: ${f.message}`);
  }
  if (!result.ok) process.exit(1);
  console.log(`[skill-lint] ok: ${result.findings.length} finding(s)`);
}
