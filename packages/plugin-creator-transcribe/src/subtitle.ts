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

/** Render SRT (cue syntax HH:MM:SS,mmm --> HH:MM:SS,mmm). */
export function toSrt(segments: readonly TranscriptSegment[]): string {
  return (
    segments
      .map(
        (segment, index) =>
          `${index + 1}\n${srtTime(segment.startMs)} --> ${srtTime(segment.endMs)}\n${segment.text}`,
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
          `${vttTime(segment.startMs)} --> ${vttTime(segment.endMs)}\n${segment.text}`,
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
        `Dialogue: 0,${assTime(segment.startMs)},${assTime(segment.endMs)},Default,,0,0,0,,${segment.text.replace(/,/g, "，")}`,
    )
    .join("\n");
  return header + events + "\n";
}

