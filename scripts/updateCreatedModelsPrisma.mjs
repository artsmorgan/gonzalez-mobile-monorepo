import fs from 'fs';
import path from 'path';

const root = process.cwd();

const CREATED_LIST_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-modificado-modelos-nuevos-filtrados.md',
);
const SCHEMA_MOD_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'schema-modificado.txt',
);
const OUTPUT_CREATED_MODELS_PATH = path.join(
  root,
  'apps',
  'server',
  'docs',
  'created-models-prisma.txt',
);

async function readFile(p) {
  return fs.promises.readFile(p, 'utf8');
}

function extractCreatedModelsList(md) {
  const lines = md.split('\n');
  const models = [];
  let inCreated = false;
  for (const line of lines) {
    if (line.startsWith('## Total creadas:')) {
      inCreated = true;
      continue;
    }
    if (!inCreated) continue;
    if (/^##\s/.test(line)) break; // next section
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/`([^`]+)`/);
    if (m) {
      models.push(m[1]);
    }
  }
  return models;
}

function extractModelsMap(schemaText) {
  const lines = schemaText.split('\n');
  const map = new Map(); // modelName -> full text
  const reModel = /^model\s+([A-Za-z0-9_]+)\s*\{/;

  let currentName = null;
  let buffer = [];
  for (const line of lines) {
    if (currentName == null) {
      const m = line.match(reModel);
      if (m) {
        currentName = m[1];
        buffer = [line];
      }
    } else {
      buffer.push(line);
      if (line.trim().startsWith('}')) {
        map.set(currentName, buffer.join('\n'));
        currentName = null;
        buffer = [];
      }
    }
  }
  return map;
}

async function main() {
  const [createdDoc, schemaMod] = await Promise.all([
    readFile(CREATED_LIST_PATH),
    readFile(SCHEMA_MOD_PATH),
  ]);

  const createdModels = extractCreatedModelsList(createdDoc);
  const modModelsMap = extractModelsMap(schemaMod);

  const lines = [];
  lines.push('# Modelos Prisma creados (no existían en schema-original)');
  lines.push('');
  lines.push(
    'Este archivo agrupa los modelos de Prisma de las tablas listadas como **creadas** en `schema-modificado-modelos-nuevos-filtrados.md`, extraídos desde `schema-modificado.txt`.',
  );
  lines.push('');

  createdModels.forEach((name) => {
    const block = modModelsMap.get(name);
    if (!block) {
      // Modelo no encontrado en schema-modificado; lo anotamos como comentario
      lines.push(`// Modelo "${name}" no encontrado en schema-modificado.txt`);
      lines.push('');
      return;
    }
    lines.push(`// ===== ${name} =====`);
    lines.push(block);
    lines.push('');
  });

  await fs.promises.writeFile(
    OUTPUT_CREATED_MODELS_PATH,
    lines.join('\n'),
    'utf8',
  );

  console.log(
    `Updated ${OUTPUT_CREATED_MODELS_PATH} with ${createdModels.length} created models.`,
  );
}

main().catch((err) => {
  console.error('Error updating created-models-prisma:', err);
  process.exit(1);
});

