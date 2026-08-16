/**
 * creator-motion template fixtures (CREATOR-012).
 *
 * Fully-local deterministic templates with metadata (id, name, aspectRatios,
 * inputSchema, estimatedDuration, engine). CI never needs Remotion.
 */
export interface MotionTemplateInputField {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
}

export interface MotionTemplate {
  id: string;
  name: string;
  /** Supported aspect ratios, e.g. "16:9", "9:16", "1:1", "4:5". */
  aspectRatios: readonly string[];
  inputSchema: readonly MotionTemplateInputField[];
  /** Deterministic render duration in seconds (used for the timeout budget). */
  estimatedDuration: number;
  engine: string;
}

export const MOTION_TEMPLATES: readonly MotionTemplate[] = [
  {
    id: "intro-card",
    name: "Intro title card",
    aspectRatios: ["16:9", "9:16", "1:1"],
    inputSchema: [
      { name: "title", type: "string", required: true, description: "headline text" },
      { name: "subtitle", type: "string", description: "subtitle text" },
    ],
    estimatedDuration: 3,
    engine: "mock",
  },
  {
    id: "lower-thirds",
    name: "Lower-thirds caption",
    aspectRatios: ["16:9", "9:16"],
    inputSchema: [
      { name: "name", type: "string", required: true, description: "speaker name" },
      { name: "role", type: "string", description: "speaker role" },
    ],
    estimatedDuration: 5,
    engine: "mock",
  },
  {
    id: "outro-card",
    name: "Outro / end card",
    aspectRatios: ["16:9", "9:16", "1:1", "4:5"],
    inputSchema: [
      { name: "heading", type: "string", required: true, description: "outro heading" },
      { name: "showFollow", type: "boolean", description: "show follow prompt" },
    ],
    estimatedDuration: 4,
    engine: "mock",
  },
];

export function getTemplate(id: string): MotionTemplate | undefined {
  return MOTION_TEMPLATES.find((t) => t.id === id);
}

export type InputOutcome =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string };

/** Validate template input against its inputSchema (required fields + types). */
export function validateTemplateInput(
  template: MotionTemplate,
  input: Record<string, unknown>,
): InputOutcome {
  const record = input ?? {};
  for (const field of template.inputSchema) {
    if (field.required && record[field.name] === undefined) {
      return { ok: false, message: `template "${template.id}" requires input field "${field.name}"` };
    }
  }
  for (const [key, value] of Object.entries(record)) {
    const field = template.inputSchema.find((f) => f.name === key);
    if (!field) {
      return { ok: false, message: `template "${template.id}" has no input field "${key}"` };
    }
    const actual = Array.isArray(value) ? "array" : typeof value;
    if (actual !== field.type) {
      return {
        ok: false,
        message: `input field "${key}" must be ${field.type}, got ${actual}`,
      };
    }
  }
  return { ok: true, value: record };
}
