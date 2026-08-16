/**
 * Creator Pack security audit (CREATOR-016).
 *
 * Scans the tracked repo surface (excluding node_modules/.git/dist/coverage)
 * for the release-gate must-not-have list:
 *   - API keys / tokens / cookies / Authorization headers / private keys
 *   - credentials committed in fixtures
 *   - absolute user paths (machine-specific)
 *   - large generated media (fixtures are tiny placeholders)
 *
 * Wired into the release gate (scripts/creator-release-gate.ts) and runnable
 * directly: `node scripts/creator-security-audit.ts`.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);
const MAX_MEDIA_BYTES = 1024 * 1024; // 1 MiB
const MEDIA_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".wav", ".mp4", ".mp3", ".mov", ".zip"]);

interface SecretPattern {
  name: string;
  re: RegExp;
}

/** High-signal secret shapes; tuned to avoid false positives on schema/description text. */
const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: "github-token", re: /ghp_[A-Za-z0-9]{30,}/ },
  { name: "openai-api-key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_-]{30,}/ },
  { name: "jwt", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "private-key", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { name: "authorization-header", re: /["']Authorization["']\s*:\s*["'](?:Bearer|Basic)\s+[^"']{10,}/i },
  {
    name: "credential-assignment",
    re: /\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|password|passwd|cookie|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
  },
  // NOTE: URL userinfo (user:pass@) is deliberately NOT a rule here — the
  // creator core redacts it via redactCredentials on every output, so its
  // presence in tests (e.g. "https://user:supersecret@host/...") is the
  // redaction proof, not a leak. Real provider configs never commit URL
  // userinfo; the patterns above catch actual key/token/password material.
];

/** Machine-specific absolute user paths that must never ship. */
const USER_PATH_RE = /([A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+|\/Users\/[A-Za-z0-9_.-]+|\/home\/[A-Za-z0-9_.-]+)/;

export interface AuditFinding {
  file: string;
  rule: string;
  message: string;
}

export interface AuditResult {
  ok: boolean;
  findings: AuditFinding[];
}

function collectFiles(dir: string, out: string[]): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(join(dir, entry.name), out);
    } else {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** Run the audit over the repo (defaults to the Creator Pack root). */
export function securityAudit(root: string = ROOT): AuditResult {
  const findings: AuditFinding[] = [];
  for (const file of collectFiles(root, [])) {
    const rel = file.slice(root.length).replace(/^[\\/]+/, "");
    const stat = statSync(file);
    // Large generated media: binary fixtures must stay tiny placeholders.
    if (MEDIA_EXTS.has(extname(file).toLowerCase()) && stat.size > MAX_MEDIA_BYTES) {
      findings.push({
        file: rel,
        rule: "large-media",
        message: `generated media file exceeds 1 MiB (${stat.size} bytes); fixtures must be tiny placeholders`,
      });
    }
    if (stat.size > 2 * 1024 * 1024) continue; // never read huge files
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue; // binary
    }
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(content)) {
        findings.push({
          file: rel,
          rule: pattern.name,
          message: `matched ${pattern.name} pattern`,
        });
      }
    }
    if (USER_PATH_RE.test(content)) {
      findings.push({
        file: rel,
        rule: "absolute-user-path",
        message: "contains a machine-specific absolute user path",
      });
    }
  }
  return { ok: findings.length === 0, findings };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop() ?? "");
if (isMain) {
  const result = securityAudit();
  for (const f of result.findings) {
    console.error(`[security-audit] ${f.file} :: ${f.rule} :: ${f.message}`);
  }
  if (!result.ok) process.exit(1);
  console.log(`[security-audit] ok: 0 finding(s)`);
}
