import fs from 'fs';
import path from 'path';

const root = process.cwd();

const PREEXISTENT_DOC_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-modificado-modelos-nuevos-filtrados.md',
);
const SCHEMA_ORIGINAL_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-original.txt',
);
const SCHEMA_MOD_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-modificado.txt',
);
const OUTPUT_DIFF_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'preexistent-tables-differences.md',
);

async function readFile(p) {
  return fs.promises.readFile(p, 'utf8');
}

function extractPreexistentTables(md) {
  const lines = md.split('\n');
  const result = [];
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('### Total preexistentes:')) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^##\s/.test(line)) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/`([^`]+)`/);
    if (match) {
      result.push(match[1]);
    }
  }
  return result;
}

function extractModelsMap(schemaText) {
  const lines = schemaText.split('\n');
  const map = new Map(); // modelName -> { start, endExclusive, lines }
  const reModel = /^model\s+([A-Za-z0-9_]+)\s*\{/;

  let current = null;
  let currentName = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (currentName == null) {
      const m = line.match(reModel);
      if (m) {
        currentName = m[1];
        current = { start: i, lines: [line] };
      }
    } else {
      current.lines.push(line);
      if (/^\}/.test(line.trim())) {
        current.end = i + 1;
        map.set(currentName, current);
        currentName = null;
        current = null;
      }
    }
  }
  return map;
}

function normalizeLine(line) {
  return line
    .replace(/\s+/g, ' ')
    .replace(/\s+@/g, ' @')
    .trim();
}

function computeNewLines(origBlock, modBlock) {
  if (!origBlock || !modBlock) return [];
  const origLines = new Set();
  for (let i = 1; i < origBlock.lines.length - 1; i++) {
    const t = normalizeLine(origBlock.lines[i]);
    if (!t) continue;
    origLines.add(t);
  }
  const newLines = [];
  for (let i = 1; i < modBlock.lines.length - 1; i++) {
    const raw = modBlock.lines[i].trim();
    const t = normalizeLine(modBlock.lines[i]);
    if (!t) continue;
    if (!origLines.has(t)) {
      newLines.push(raw);
    }
  }
  return newLines;
}

async function main() {
  const [preDoc, schemaOriginal, schemaMod] = await Promise.all([
    readFile(PREEXISTENT_DOC_PATH),
    readFile(SCHEMA_ORIGINAL_PATH),
    readFile(SCHEMA_MOD_PATH),
  ]);

  const preTables = extractPreexistentTables(preDoc);
  const origModels = extractModelsMap(schemaOriginal);
  const modModels = extractModelsMap(schemaMod);

  const tableDiffs = [];

  for (const table of preTables) {
    const orig = origModels.get(table);
    const mod = modModels.get(table);
    if (!mod) continue; // no model in modified -> nothing to diff
    if (!orig) {
      // Should not happen for "preexistentes", but guard anyway
      continue;
    }
    const newLines = computeNewLines(orig, mod);
    if (newLines.length > 0) {
      tableDiffs.push({ table, newLines });
    }
  }

  const totalAnalysed = preTables.length;
  const totalWithDiffs = tableDiffs.length;

  const outLines = [];
  outLines.push('# Campos y relaciones nuevos en tablas preexistentes');
  outLines.push('');
  outLines.push(
    'Este documento lista las **líneas nuevas** (campos/relaciones) añadidas en los modelos preexistentes, comparando `schema-modificado.txt` contra `schema-original.txt`, para las tablas listadas como preexistentes en `schema-modificado-modelos-nuevos-filtrados.md`.',
  );
  outLines.push('');
  outLines.push(`## Total de tablas analizadas: ${totalAnalysed}`);
  outLines.push('');
  outLines.push(`## Tablas con campos/relaciones nuevos: ${totalWithDiffs}`);
  outLines.push('');

  tableDiffs.forEach((item, idx) => {
    outLines.push(`## ${idx + 1}. \`${item.table}\``);
    outLines.push('');
    outLines.push(`### Líneas nuevas (${item.newLines.length})`);
    outLines.push('');
    item.newLines.forEach((ln) => {
      outLines.push(`- \`${ln}\``);
    });
    outLines.push('');
  });

  await fs.promises.writeFile(OUTPUT_DIFF_PATH, outLines.join('\n'), 'utf8');
  console.log(
    `Updated ${OUTPUT_DIFF_PATH} (analysed: ${totalAnalysed}, with diffs: ${totalWithDiffs})`,
  );
}

main().catch((err) => {
  console.error('Error updating preexistent-tables-differences:', err);
  process.exit(1);
});

