#!/usr/bin/env node
/** Block writes outside allowlist when ACTIVE-MODULE is set. Always block secret paths. */
import { readFileSync, existsSync } from 'fs';
import { join, normalize } from 'path';

const REPO = process.cwd().replace(/\\/g, '/');
const REVIEW = '.cursor/review';
const MANIFEST = join(REVIEW, 'modules-manifest.json');
const ACTIVE = join(REVIEW, 'ACTIVE-MODULE.txt');

const DENY_PATTERNS = [
  /^\.env/i,
  /google-services/i,
  /\/package\.json$/i,
  /\/package-lock\.json$/i,
  /\/yarn\.lock$/i,
  /node_modules\//i,
  /\.pem$/i,
  /firebase.*\.json$/i,
];

const ALWAYS_ALLOW_PREFIXES = [
  '.cursor/review/',
  '.cursor/rules/',
  '.cursor/skills/',
  '.cursor/hooks/',
  '.cursor/hooks.json',
  'AGENTS.md',
];

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '{}';
  }
}

function toPosix(p) {
  return normalize(String(p)).replace(/\\/g, '/');
}

function relPath(absOrRel) {
  const p = toPosix(absOrRel);
  if (p.startsWith(REPO + '/')) return p.slice(REPO.length + 1);
  return p.replace(/^\.\//, '');
}

function matchesPattern(filePath, pattern) {
  const p = toPosix(pattern);
  if (p.endsWith('/**')) {
    const prefix = p.slice(0, -3);
    return filePath === prefix || filePath.startsWith(prefix + '/');
  }
  if (p.includes('*')) {
    const re = new RegExp('^' + p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    return re.test(filePath);
  }
  return filePath === p;
}

function isDenied(filePath) {
  return DENY_PATTERNS.some((re) => re.test(filePath));
}

function loadAllowedPaths() {
  const paths = new Set(ALWAYS_ALLOW_PREFIXES);
  if (!existsSync(MANIFEST)) return paths;

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  (manifest.globalAllowedPaths || []).forEach((p) => paths.add(p));

  let activeId = '';
  if (existsSync(ACTIVE)) {
    activeId = readFileSync(ACTIVE, 'utf8').trim();
  }
  if (!activeId) return paths;

  const mod = (manifest.modules || []).find((m) => m.id === activeId);
  (mod?.allowedPaths || []).forEach((p) => paths.add(p));
  return paths;
}

function isAllowed(filePath, allowed) {
  if (ALWAYS_ALLOW_PREFIXES.some((p) => filePath === p || filePath.startsWith(p))) return true;
  for (const pattern of allowed) {
    if (matchesPattern(filePath, pattern)) return true;
  }
  return false;
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
}

function deny(userMessage, agentMessage) {
  process.stdout.write(
    JSON.stringify({ permission: 'deny', user_message: userMessage, agent_message: agentMessage }) + '\n'
  );
}

try {
  const raw = readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const tool = input.tool_name || input.tool || '';
  const ti = input.tool_input || input.arguments || input.input || {};

  let filePath = ti.path || ti.file_path || ti.target || ti.filePath || '';

  if (!filePath || !/^(Write|StrReplace|ApplyPatch|Delete|EditNotebook)/i.test(String(tool))) {
    allow();
    process.exit(0);
  }

  const rel = relPath(filePath);

  if (rel.startsWith('.cursor/')) {
    allow();
    process.exit(0);
  }

  if (isDenied(rel)) {
    deny(`Escritura bloqueada: ruta protegida (${rel}).`, `Hook deny: protected path ${rel}`);
    process.exit(0);
  }

  const allowed = loadAllowedPaths();
  const activeExists = existsSync(ACTIVE) && readFileSync(ACTIVE, 'utf8').trim();

  if (!activeExists && (rel.startsWith('apps/') || rel.startsWith('packages/'))) {
    deny(
      'Escritura en apps/ bloqueada: establece ACTIVE-MODULE en .cursor/review/ACTIVE-MODULE.txt (skill module-fixer).',
      'Hook deny: no ACTIVE-MODULE for apps/ write'
    );
    process.exit(0);
  }

  if (!isAllowed(rel, allowed)) {
    deny(
      `Escritura fuera de alcance: ${rel}. Ver allowedPaths del módulo activo.`,
      `Hook deny: not in allowlist: ${rel}`
    );
    process.exit(0);
  }

  allow();
  process.exit(0);
} catch {
  allow();
  process.exit(0);
}
