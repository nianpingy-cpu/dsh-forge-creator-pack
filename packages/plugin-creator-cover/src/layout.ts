/**
 * creator-cover layout engine (CREATOR-009).
 *
 * LocalLayoutProvider is a deterministic layout engine: it places a title
 * and subject inside a platform profile's safe area, detects text overflow,
 * rejects safe-area violations, and falls back to a supported font when an
 * unknown font is requested.
 */
import type { PlatformProfile } from "./platforms.js";

export const SUPPORTED_FONTS = [
  "Arial",
  "Helvetica",
  "Inter",
  "Noto Sans SC",
] as const;

export const DEFAULT_FONT = "Arial";

const CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_TITLE_FONT_PX = 72;
const DEFAULT_SUBJECT_FONT_PX = 48;
const LINE_HEIGHT_RATIO = 1.2;

export interface TextBox {
  text: string;
  font: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  profile: PlatformProfile;
  safeArea: { x: number; y: number; width: number; height: number };
  titleBox?: TextBox;
  subjectBox?: TextBox;
  font: string;
  fontFallback: boolean;
  warnings: string[];
}

export interface LayoutOptions {
  title?: string;
  subject?: string;
  font?: string;
  titleFontSize?: number;
  subjectFontSize?: number;
}

export type LayoutOutcome =
  | { ok: true; result: LayoutResult }
  | { ok: false; message: string };

/** Resolve a font name to a supported font, recording a fallback. */
function resolveFont(requested: string | undefined): {
  font: string;
  fallback: boolean;
} {
  const font = (requested ?? DEFAULT_FONT).trim();
  if ((SUPPORTED_FONTS as readonly string[]).includes(font)) {
    return { font, fallback: false };
  }
  return { font: DEFAULT_FONT, fallback: true };
}

/**
 * Approximate how many lines a text occupies in a box of the given width,
 * using a fixed character-width ratio (deterministic; no real font metrics).
 */
export function estimateLines(text: string, boxWidth: number, fontSize: number): number {
  const charsPerLine = Math.max(1, Math.floor(boxWidth / (fontSize * CHAR_WIDTH_RATIO)));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function boxHeight(lines: number, fontSize: number): number {
  return Math.round(lines * fontSize * LINE_HEIGHT_RATIO);
}

/** Place title and subject inside the profile's safe area with overflow + safe-area checks. */
export function layoutCover(profile: PlatformProfile, opts: LayoutOptions): LayoutOutcome {
  const safeArea = {
    x: profile.safeArea.left,
    y: profile.safeArea.top,
    width: Math.max(1, profile.width - profile.safeArea.left - profile.safeArea.right),
    height: Math.max(1, profile.height - profile.safeArea.top - profile.safeArea.bottom),
  };
  const { font, fallback } = resolveFont(opts.font);
  const warnings: string[] = [];
  if (fallback) warnings.push(`unsupported font; fell back to ${font}`);

  const title = opts.title?.trim();
  const subject = opts.subject?.trim();
  if (!title && !subject) {
    return { ok: false, message: "cover layout requires a title or a subject" };
  }

  const titleFontSize = opts.titleFontSize ?? DEFAULT_TITLE_FONT_PX;
  const subjectFontSize = opts.subjectFontSize ?? DEFAULT_SUBJECT_FONT_PX;
  if (titleFontSize <= 0 || subjectFontSize <= 0) {
    return { ok: false, message: "font sizes must be positive" };
  }

  // Text overflow detection (char limits + physical fit).
  if (title) {
    if (title.length > profile.maxTitleLength) {
      return {
        ok: false,
        message: `text overflow: title (${title.length} chars) exceeds the ${profile.maxTitleLength}-char limit`,
      };
    }
    const titleHeight = boxHeight(estimateLines(title, safeArea.width, titleFontSize), titleFontSize);
    if (titleHeight > safeArea.height) {
      return {
        ok: false,
        message: `text overflow: title does not fit the safe area (${safeArea.width}x${safeArea.height}px)`,
      };
    }
  }
  if (subject) {
    if (subject.length > profile.maxSubjectLength) {
      return {
        ok: false,
        message: `text overflow: subject (${subject.length} chars) exceeds the ${profile.maxSubjectLength}-char limit`,
      };
    }
  }

  const titleBox: TextBox | undefined = title
    ? {
        text: title,
        font,
        fontSize: titleFontSize,
        x: safeArea.x,
        y: safeArea.y,
        width: safeArea.width,
        height: boxHeight(estimateLines(title, safeArea.width, titleFontSize), titleFontSize),
      }
    : undefined;

  const subjectY = safeArea.y + (titleBox?.height ?? 0);
  const subjectBox: TextBox | undefined = subject
    ? {
        text: subject,
        font,
        fontSize: subjectFontSize,
        x: safeArea.x,
        y: subjectY,
        width: safeArea.width,
        height: boxHeight(estimateLines(subject, safeArea.width, subjectFontSize), subjectFontSize),
      }
    : undefined;

  // Safe-area violation detection (boxes must stay fully inside the safe area,
  // and the subject must fit below the title).
  for (const box of [titleBox, subjectBox]) {
    if (!box) continue;
    if (
      box.x < safeArea.x ||
      box.y < safeArea.y ||
      box.x + box.width > safeArea.x + safeArea.width ||
      box.y + box.height > safeArea.y + safeArea.height
    ) {
      return { ok: false, message: "safe area violation: text box escapes the platform safe area" };
    }
  }

  return {
    ok: true,
    result: { profile, safeArea, titleBox, subjectBox, font, fontFallback: fallback, warnings },
  };
}
