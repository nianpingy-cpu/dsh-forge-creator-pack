/**
 * creator-transcribe subtitle rendering (CREATOR-006).
 *
 * GREEN: valid SRT / VTT / ASS output.
 */
import type { TranscriptSegment } from "./types.js";

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** SRT timestamp: HH:MM:SS,mmm */
function srtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

/** WebVTT timestamp: HH:MM:SS.mmm */
function vttTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(milli, 3)}`;
}

/** ASS timestamp: H:MM:SS.CC */
function assTime(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${pad(s)}.${pad(cs)}`;
}

/**
 * Control characters (C0 except tab/newline, plus DEL) that must not appear
 * in subtitle output. Built via String.fromCharCode so the regex literal
 * itself contains no control characters (satisfies eslint no-control-regex).
 */
const CONTROL_CHAR_CLASS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g",
);

/**
 * Collapse transcript text to a single safe line for SRT/VTT cue bodies.
 *
 * Subtitle cue bodies are line-oriented: a blank line terminates the cue
 * (SRT) and lines beginning with `STYLE`/`NOTE` become special blocks (VTT).
 * Because transcript text originates from audio content (which a creator can
 * transcribe from third-party media), it must never be able to inject cue
 * boundaries, timestamp lines, or block headers.
 */
function sanitizeLine(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROL_CHAR_CLASS, "")
    .trim();
}

/**
 * Sanitize transcript text for ASS Dialogue text.
 *
 * ASS interprets `{...}` as override tags and uses line-oriented sections
 * (`[Script Info]`, `[Events]`); a raw newline or brace pair in the text can
 * truncate/restructure the event stream or inject styling. Newlines are
 * collapsed and `{`/`}` are replaced with fullwidth glyphs so libass/Aegisub
 * treat them as literal characters. Commas are replaced to protect the
 * Dialogue field delimiter.
 */
function sanitizeAssText(text: string): string {
  return sanitizeLine(text)
    .replace(/{/g, "｛")
    .replace(/}/g, "｝")
    .replace(/,/g, "，");
}

/** Render SRT (cue syntax HH:MM:SS,mmm --> HH:MM:SS,mmm). */
export function toSrt(segments: readonly TranscriptSegment[]): string {
  return (
    segments
      .map(
        (segment, index) =>
          `${index + 1}\n${srtTime(segment.startMs)} --> ${srtTime(segment.endMs)}\n${sanitizeLine(segment.text)}`,
      )
      .join("\n\n") + "\n"
  );
}

/** Render WebVTT (must start with the WEBVTT header). */
export function toVtt(segments: readonly TranscriptSegment[]): string {
  return (
    "WEBVTT\n\n" +
    segments
      .map(
        (segment) =>
          `${vttTime(segment.startMs)} --> ${vttTime(segment.endMs)}\n${sanitizeLine(segment.text)}`,
      )
      .join("\n\n") +
    "\n"
  );
}

/** Render ASS (Script Info + Dialogue events). */
export function toAss(segments: readonly TranscriptSegment[]): string {
  const header = `[Script Info]
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const events = segments
    .map(
      (segment) =>
        `Dialogue: 0,${assTime(segment.startMs)},${assTime(segment.endMs)},Default,,0,0,0,,${sanitizeAssText(segment.text)}`,
    )
    .join("\n");
  return header + events + "\n";
}

