#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '{}';
  }
}

function allow() {
  process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
}

function deny(msg, agent) {
  process.stdout.write(
    JSON.stringify({ permission: 'deny', user_message: msg, agent_message: agent }) + '\n'
  );
}

try {
  const raw = readStdin();
  const input = raw.trim() ? JSON.parse(raw) : {};
  const command = String(input.command || input.cmd || '').trim();

  if (!/\bgit\s+commit\b/i.test(command)) {
    allow();
    process.exit(0);
  }

  const approvalPath = '.cursor/review/APPROVAL.md';
  if (!existsSync(approvalPath)) {
    deny(
      'Commit bloqueado: falta APPROVAL.md con status: PASS. Ejecuta @coder-approval primero.',
      'Hook deny: no APPROVAL.md'
    );
    process.exit(0);
  }

  const content = readFileSync(approvalPath, 'utf8');
  if (!/status:\s*PASS/i.test(content)) {
    deny('Commit bloqueado: APPROVAL.md no tiene status: PASS.', 'Hook deny: APPROVAL not PASS');
    process.exit(0);
  }

  allow();
  process.exit(0);
} catch {
  allow();
  process.exit(0);
}
