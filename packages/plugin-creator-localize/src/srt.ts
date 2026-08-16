/**
 * creator-localize SRT utilities (CREATOR-011).
 *
 * Deterministic SRT parse / serialize / validate / align / resegment.
 */
export interface SrtCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** SRT timestamp: HH:MM:SS,mmm */
export function srtTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

function parseTime(token: string): number | undefined {
  const m = token.match(/^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!m) return undefined;
  return (
    Number(m[1]) * 3_600_000 +
    Number(m[2]) * 60_000 +
    Number(m[3]) * 1000 +
    Number(m[4])
  );
}

export type SrtParseOutcome =
  | { ok: true; cues: SrtCue[] }
  | { ok: false; message: string };

/** Parse SRT text into cues, validating timestamps and monotonicity. */
export function parseSrt(text: string): SrtParseOutcome {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    const idx = Number(lines[0]);
    const timing = lines[1];
    if (!Number.isInteger(idx) || !timing) continue;
    const m = timing.match(/^(\S+) --> (\S+)$/);
    if (!m) {
      return { ok: false, message: `invalid cue timing: ${timing}` };
    }
    const start = parseTime(m[1]);
    const end = parseTime(m[2]);
    if (start === undefined || end === undefined) {
      return { ok: false, message: `invalid timestamp in cue ${idx}` };
    }
    if (end < start) {
      return { ok: false, message: `cue ${idx} has end before start` };
    }
    cues.push({ index: idx, startMs: start, endMs: end, text: lines.slice(2).join("\n") });
  }
  if (cues.length === 0) {
    return { ok: false, message: "no valid subtitle cues found" };
  }
  for (let i = 1; i < cues.length; i++) {
    if (cues[i]!.startMs < cues[i - 1]!.startMs) {
      return { ok: false, message: `cues are not monotonic at cue ${cues[i]!.index}` };
    }
  }
  return { ok: true, cues };
}

/** Serialize cues to SRT text with valid timestamps. */
export function serializeSrt(cues: readonly SrtCue[]): string {
  return (
    cues
      .map(
        (c, i) =>
          `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}`,
      )
      .join("\n\n") + "\n"
  );
}

export type AlignOutcome =
  | { ok: true; cues: SrtCue[] }
  | { ok: false; message: string };

/**
 * Shift all cue timestamps by offsetMs. Rejects when any cue would become
 * negative (alignment cannot produce negative time).
 */
export function alignCues(cues: readonly SrtCue[], offsetMs: number): AlignOutcome {
  if (!Number.isFinite(offsetMs)) {
    return { ok: false, message: "offsetMs must be a finite number" };
  }
  const shifted: SrtCue[] = cues.map((c, i) => ({
    index: i + 1,
    startMs: c.startMs + offsetMs,
    endMs: c.endMs + offsetMs,
    text: c.text,
  }));
  if (shifted.some((c) => c.startMs < 0 || c.endMs < 0)) {
    return { ok: false, message: `alignment would produce negative time (offset ${offsetMs}ms)` };
  }
  return { ok: true, cues: shifted };
}

export type ResegmentOutcome =
  | { ok: true; cues: SrtCue[] }
  | { ok: false; message: string };

/**
 * Resegment cues that exceed maxDurationMs into sub-cues, keeping timestamps
 * within the original range. Monotonicity is preserved.
 */
export function resegmentCues(
  cues: readonly SrtCue[],
  maxDurationMs: number,
): ResegmentOutcome {
  if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
    return { ok: false, message: "maxDurationMs must be positive" };
  }
  const out: SrtCue[] = [];
  for (const cue of cues) {
    const duration = cue.endMs - cue.startMs;
    if (duration <= maxDurationMs) {
      out.push({ ...cue, index: out.length + 1 });
      continue;
    }
    const parts = Math.ceil(duration / maxDurationMs);
    for (let p = 0; p < parts; p++) {
      const start = cue.startMs + Math.round((duration * p) / parts);
      const end = cue.startMs + Math.round((duration * (p + 1)) / parts);
      out.push({
        index: out.length + 1,
        startMs: start,
        endMs: Math.max(start, end),
        text: cue.text,
      });
    }
  }
  return { ok: true, cues: out };
}
