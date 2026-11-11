import fs from 'fs';
import path from 'path';

const root = process.cwd();

const MOBILE_TABLES_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'mobile-referenced-db-tables.md',
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
const OUTPUT_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-modificado-modelos-nuevos-filtrados.md',
);

async function readFile(p) {
  return fs.promises.readFile(p, 'utf8');
}

function extractTablesFromMobileDoc(md) {
  const lines = md.split('\n');
  const tables = [];
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('## Total incluidas:')) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^##\s/.test(line)) break;
    if (!line.trim()) continue;
    const match = line.match(/`([^`]+)`/);
    if (match) {
      tables.push(match[1]);
    }
  }
  return tables;
}

function extractModelsFromSchema(schemaText) {
  const models = new Set();
  const lines = schemaText.split('\n');
  const re = /^model\s+([A-Za-z0-9_]+)\s*\{/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) models.add(m[1]);
  }
  return models;
}

async function main() {
  const [mobileMd, schemaOriginal, schemaMod] = await Promise.all([
    readFile(MOBILE_TABLES_PATH),
    readFile(SCHEMA_ORIGINAL_PATH),
    readFile(SCHEMA_MOD_PATH),
  ]);

  const tables = extractTablesFromMobileDoc(mobileMd);
  const origModels = extractModelsFromSchema(schemaOriginal);
  const modModels = extractModelsFromSchema(schemaMod);

  const created = [];
  const preexisting = [];

  for (const table of tables) {
    if (!modModels.has(table)) {
      // Tabla usada pero sin modelo Prisma en schema-modificado: la omitimos
      continue;
    }
    if (origModels.has(table)) {
      preexisting.push(table);
    } else {
      created.push(table);
    }
  }

  const createdLines = [];
  created.forEach((name, idx) => {
    createdLines.push(`${idx + 1}. \`${name}\``);
  });

  const preexistingLines = [];
  preexisting.forEach((name, idx) => {
    preexistingLines.push(`${idx + 1}. \`${name}\``);
  });

  const out = [
    '# Modelos de `schema-modificado` que no están en `schema-original`',
    '',
    'Se listan los modelos que aparecen en `apps/server/docs/schema-modificado.txt` y no aparecen en `apps/server/docs/schema-original.txt`, excluyendo los que están en la sección **Excluidas por ID UUID/CUID** de `apps/server/docs/mobile-referenced-db-tables.md`.',
    '',
    `## Total creadas: ${created.length}`,
    '',
    ...createdLines,
    '',
    '## Tablas en "Total incluidas" de mobile-referenced-db-tables.md que NO están en esta lista',
    '',
    'Tablas que aparecen en la sección **Total incluidas** de `apps/server/docs/mobile-referenced-db-tables.md` pero sí existen en `schema-original.txt` (es decir, eran preexistentes).',
    '',
    `### Total preexistentes: ${preexisting.length}`,
    '',
    ...preexistingLines,
    '',
  ].join('\n');

  await fs.promises.writeFile(OUTPUT_PATH, out, 'utf8');
  console.log(`Updated ${OUTPUT_PATH}`);
  console.log(`Created: ${created.length}, Preexisting: ${preexisting.length}`);
}

main().catch((err) => {
  console.error('Error updating schema-modificado-modelos-nuevos-filtrados:', err);
  process.exit(1);
});

