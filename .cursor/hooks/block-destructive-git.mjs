#!/usr/bin/env node
import { readFileSync } from 'fs';

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

  const denyPatterns = [
    /git\s+push\s+.*--force/i,
    /git\s+push\s+-f\b/i,
    /git\s+reset\s+--hard/i,
    /git\s+clean\s+-f/i,
    /git\s+checkout\s+\.\s*$/i,
    /git\s+branch\s+-D/i,
    /rm\s+-rf/i,
    /Remove-Item\s+.*-Recurse\s+-Force/i,
  ];

  for (const re of denyPatterns) {
    if (re.test(command)) {
      deny('Comando destructivo bloqueado (test-soft-001).', `Blocked: ${command}`);
      process.exit(0);
    }
  }

  allow();
  process.exit(0);
} catch {
  allow();
  process.exit(0);
}
