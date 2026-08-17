/**
 * creator-publish draft registry (CREATOR-013).
 *
 * In-memory store of post drafts with their content hash. A draft is the
 * unit that must be explicitly approved before any remote publish/schedule.
 */
import { createHash } from "node:crypto";
import type { PlatformPostDraft, PublishStatus } from "@dsh-forge-creator/core";

export interface DraftRecord {
  id: string;
  draft: PlatformPostDraft;
  contentHash: string;
  status: PublishStatus;
  scheduledAt?: string;
  postId?: string;
}

const drafts = new Map<string, DraftRecord>();
let counter = 0;

export function contentHashOf(draft: PlatformPostDraft): string {
  return createHash("sha256")
    .update(JSON.stringify(draft))
    .digest("hex")
    .slice(0, 40);
}

export function createDraftRecord(draft: PlatformPostDraft): DraftRecord {
  counter += 1;
  const record: DraftRecord = {
    id: `draft-${counter}`,
    draft,
    contentHash: contentHashOf(draft),
    status: "draft",
  };
  drafts.set(record.id, record);
  return record;
}

export function getDraft(id: string): DraftRecord | undefined {
  return drafts.get(id);
}

export function listDrafts(): DraftRecord[] {
  return [...drafts.values()];
}

export function updateDraft(
  id: string,
  patch: Partial<Pick<DraftRecord, "status" | "postId" | "scheduledAt">>,
): DraftRecord | undefined {
  const record = drafts.get(id);
  if (!record) return undefined;
  Object.assign(record, patch);
  return record;
}
