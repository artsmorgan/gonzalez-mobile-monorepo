const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "../apps/server/app/prisma/schema.prisma");
const MD_PATH = path.join(__dirname, "../apps/server/docs/mobile-referenced-db-tables.md");

function findUuidTables(schemaText) {
  const uuidTables = new Set();
  const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g;
  let match;

  while ((match = modelRegex.exec(schemaText)) !== null) {
    const modelName = match[1];
    const body = match[2];
    
    // Check for @@map to get actual table name
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName;
    
    // Find id field
    const idLineMatch = body.match(/^\s*id\s+.+$/m);
    if (idLineMatch) {
      const idLine = idLineMatch[0].toLowerCase();
      if (
        idLine.includes("uuid()") ||
        idLine.includes("uuid_generate_v4") ||
        idLine.includes("@db.uuid") ||
        idLine.includes("cuid()")
      ) {
        uuidTables.add(tableName);
        uuidTables.add(modelName); // Also add model name in case it's used
      }
    }
  }

  return uuidTables;
}

function extractTablesFromMd(mdText) {
  const tables = [];
  const lines = mdText.split("\n");
  let inIncludedSection = false;
  
  for (const line of lines) {
    if (line.startsWith("## Total incluidas:")) {
      inIncludedSection = true;
      continue;
    }
    if (line.startsWith("## ") && !line.startsWith("## Total")) {
      inIncludedSection = false;
      continue;
    }
    
    if (inIncludedSection) {
      const match = line.match(/^\d+\.\s+`([^`]+)`/);
      if (match) {
        tables.push(match[1]);
      }
    }
  }
  
  return tables;
}

function main() {
  const schemaText = fs.readFileSync(SCHEMA_PATH, "utf8");
  const mdText = fs.readFileSync(MD_PATH, "utf8");
  
  const uuidTables = findUuidTables(schemaText);
  const listedTables = extractTablesFromMd(mdText);
  
  const filtered = listedTables.filter((t) => !uuidTables.has(t));
  const excluded = listedTables.filter((t) => uuidTables.has(t));
  
  // Build new markdown content
  const lines = [];
  lines.push("# Tablas DB usadas en apps/server (incluyendo include, sin IDs UUID)");
  lines.push("");
  lines.push("## Criterio");
  lines.push("");
  lines.push("- Fuente: todos los archivos `.ts` dentro de `apps/server`.");
  lines.push("- Detección:");
  lines.push("  - `callDynamicPrisma({ data: { table: \"...\" } })`");
  lines.push("  - `prisma.<model>` (mapeado a tabla real via `@@map` en `schema.prisma`).");
  lines.push("  - Relaciones usadas por `include` en consultas Prisma (incluye `include` anidados).");
  lines.push("- Exclusión aplicada: tablas cuyo campo `id` usa UUID/CUID en `schema.prisma`.");
  lines.push("");
  lines.push(`## Total incluidas: ${filtered.length}`);
  lines.push("");
  filtered.forEach((t, i) => lines.push(`${i + 1}. \`${t}\``));
  lines.push("");
  lines.push("## Detectadas solo via include (no directas): 0");
  lines.push("");
  lines.push("- Ninguna");
  lines.push("");
  lines.push(`## Excluidas por ID UUID/CUID: ${excluded.length}`);
  lines.push("");
  if (excluded.length === 0) {
    lines.push("- Ninguna");
  } else {
    excluded.forEach((t, i) => lines.push(`${i + 1}. \`${t}\``));
  }
  lines.push("");
  
  fs.writeFileSync(MD_PATH, lines.join("\n"), "utf8");
  console.log(`Updated ${MD_PATH}`);
  console.log(`Included: ${filtered.length}`);
  console.log(`Excluded (UUID): ${excluded.length}`);
  if (excluded.length > 0) {
    console.log("\nExcluded tables:");
    excluded.forEach((t) => console.log(`  - ${t}`));
  }
}

main();
