/**
 * Convierte exportaciones SQL Server (GO, [dbo], IDENTITY, …) a MariaDB 10.4+.
 * No modifica el archivo de origen.
 *
 * Uso:
 *   node scripts/convert_prestamos_data_mariadb.mjs
 *     → Prestamos: origen "Convert databases/Prestamos con data.sql"
 *       salida "Convert databases/Prestamos con data - MariaDB.sql"
 *
 *   node scripts/convert_prestamos_data_mariadb.mjs --src "Convert databases/FE506.sql"
 *     → salida "Convert databases/FE506 - MariaDB.sql", base `FE506` desde CREATE DATABASE del script
 *
 *   node scripts/convert_prestamos_data_mariadb.mjs --src "…" --dst "…" --db NombreBase
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const defaultPrestamosSrc = path.join(root, "Convert databases", "Prestamos con data.sql");

function escapeRegex(s) {
  return s.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

function inferDbNameFromSql(text) {
  const m = /CREATE\s+DATABASE\s+\[([^\]]+)\]/i.exec(text);
  return m ? m[1] : null;
}

function parseCli() {
  const argv = process.argv.slice(2);
  let src = defaultPrestamosSrc;
  let dst = null;
  let dbName = null;
  let explicitDst = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src" && argv[i + 1]) {
      const p = argv[++i];
      src = path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(root, p));
      continue;
    }
    if (a === "--dst" && argv[i + 1]) {
      const p = argv[++i];
      dst = path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(root, p));
      explicitDst = true;
      continue;
    }
    if (a === "--db" && argv[i + 1]) {
      dbName = argv[++i];
      continue;
    }
  }
  const usingDefaultPrestamos = path.normalize(src) === path.normalize(defaultPrestamosSrc);
  if (!explicitDst && !dst) {
    const base = path.basename(src, path.extname(src));
    dst = path.join(path.dirname(src), `${base} - MariaDB.sql`);
  }
  return { src, dst, dbName, usingDefaultPrestamos };
}

function readSqlText(filePath) {
  const raw = fs.readFileSync(filePath);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
    return raw.toString("utf16le");
  }
  if (raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff) {
    const swapped = Buffer.from(raw);
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const t = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = t;
    }
    return swapped.toString("utf16le");
  }
  return raw.toString("utf8");
}

function toMysqlIdentifiers(sql) {
  return sql.replace(/\[([^\]]+)\]/g, "`$1`").replace(/`dbo`\./g, "");
}

function cleanCommon(sql) {
  return toMysqlIdentifiers(sql)
    .replace(/\bN'([^']*)'/gi, "'$1'")
    .replace(/\bnvarchar\b/gi, "varchar")
    .replace(/\bnchar\b/gi, "char")
    .replace(/\bIDENTITY\s*\(\s*1\s*,\s*1\s*\)/gi, "AUTO_INCREMENT")
    .replace(/\bISNULL\s*\(/gi, "IFNULL(")
    .replace(/\bGETDATE\s*\(\s*\)/gi, "NOW()")
    .replace(/`datetime2`\s*\(\s*(\d+)\s*\)/gi, (_, n) => {
      const p = Math.min(6, parseInt(n, 10));
      return `datetime(${p})`;
    })
    .replace(/`datetime2`/gi, "datetime")
    .replace(/`datetimeoffset`\s*\(\s*(\d+)\s*\)/gi, (_, n) => {
      const p = Math.min(6, parseInt(n, 10));
      return `datetime(${p})`;
    })
    .replace(/`datetimeoffset`/gi, "datetime");
}

function stripQuotedTypes(sql) {
  const types = [
    "varchar",
    "char",
    "int",
    "bigint",
    "smallint",
    "tinyint",
    "float",
    "real",
    "double",
    "decimal",
    "numeric",
    "datetime",
    "date",
    "time",
    "timestamp",
    "text",
    "blob",
    "bit",
  ];
  let s = sql;
  for (const ty of types) {
    s = s.replace(new RegExp("`" + ty + "`\\(", "gi"), ty + "(");
    s = s.replace(new RegExp("`" + ty + "`", "gi"), ty);
  }
  return s.replace(/\bnumeric\s*\(/gi, "decimal(");
}

/** Literal fecha/hora para INSERT; fracción > 6 dígitos → 6 (límite MariaDB en DATETIME(f)). */
function quoteNormalizedSqlDateTimeInner(inner) {
  let u = inner.replace(/''/g, "'").replace("T", " ");
  const dot = u.indexOf(".");
  if (dot !== -1) {
    const head = u.slice(0, dot);
    let frac = u.slice(dot + 1).replace(/\D/g, "");
    if (frac.length > 6) frac = frac.slice(0, 6);
    u = frac.length ? `${head}.${frac}` : head;
  }
  return "'" + u.replace(/'/g, "''") + "'";
}

function convertCastDateTime(sql) {
  return sql
    .replace(/CAST\(N'((?:[^']|'')*)'\s+AS\s+DateTime2\)/gi, (_, inner) =>
      quoteNormalizedSqlDateTimeInner(inner)
    )
    .replace(/CAST\(N'((?:[^']|'')*)'\s+AS\s+DateTime\)/gi, (_, inner) =>
      quoteNormalizedSqlDateTimeInner(inner)
    );
}

function convertCastDate(sql) {
  return sql.replace(/CAST\(N'((?:[^']|'')*)'\s+AS\s+Date\)/gi, (_, inner) => {
    const unescaped = inner.replace(/''/g, "'");
    const d = unescaped.split("T")[0];
    return "'" + d.replace(/'/g, "''") + "'";
  });
}

function convertNumericCasts(sql) {
  return sql.replace(/CAST\(([^)]+?)\s+AS\s+Numeric\s*\(\s*18\s*,\s*2\s*\)\)/gi, (m, expr) => {
    const e = String(expr).trim();
    if (/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/.test(e)) return e;
    return `CAST(${e} AS DECIMAL(18,2))`;
  });
}

/** Cierra el paréntesis de VALUES respetando cadenas N'...' / '...' (incl. '' escapado). */
function isCompleteInsertStatement(s) {
  const m = /\bVALUES\s*\(/i.exec(s);
  if (!m) return false;
  let i = m.index + m[0].length;
  let depth = 1;
  let inString = false;
  while (i < s.length) {
    const c = s[i];
    if (inString) {
      if (c === "'" && s[i + 1] === "'") {
        i += 2;
        continue;
      }
      if (c === "'") inString = false;
      i++;
      continue;
    }
    if (c === "N" && s[i + 1] === "'") {
      inString = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      inString = true;
      i++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) {
        const rest = s.slice(i + 1).trim();
        return rest === "" || rest === ";";
      }
    }
    i++;
  }
  return false;
}

/**
 * El export SSMS a veces parte un INSERT en varias líneas por saltos dentro de N'...'.
 * Une continuaciones hasta cerrar VALUES (…) sin perder texto.
 */
function mergeInsertContinuationLines(lines) {
  const merged = [];
  let buf = "";
  for (const line of lines) {
    if (line.toUpperCase().startsWith("INSERT ")) {
      if (buf) merged.push(buf);
      buf = line;
    } else if (buf) {
      buf += " " + line;
    }
    if (buf && isCompleteInsertStatement(buf)) {
      merged.push(buf);
      buf = "";
    }
  }
  if (buf) merged.push(buf);
  return merged;
}

function convertInsertLine(line) {
  let s = line.trim();
  if (!/^INSERT\s+\[dbo\]/i.test(s)) return null;
  s = s.replace(/^INSERT\s+\[dbo\]\.\[([^\]]+)\]\s+/i, "INSERT INTO `$1` ");
  s = convertCastDateTime(s);
  s = convertCastDate(s);
  s = convertNumericCasts(s);
  s = s.replace(/\bN'/g, "'");
  s = s.replace(/\[([^\]]+)\]/g, "`$1`");
  return s.endsWith(";") ? s : s + ";";
}

function convertCreateTable(batch) {
  let sql = cleanCommon(batch);
  sql = sql.replace(/\)\s*WITH\s*\([^\)]*\)\s*ON\s*`PRIMARY`/gi, ")");
  sql = sql.replace(/WITH\s*\([^\)]*\)/gi, "");
  sql = sql.replace(/\s+ON\s+`PRIMARY`/gi, "");
  sql = sql.replace(/PRIMARY KEY\s+NONCLUSTERED/gi, "PRIMARY KEY");
  sql = sql.replace(/PRIMARY KEY\s+CLUSTERED/gi, "PRIMARY KEY");
  sql = sql.replace(/UNIQUE\s+NONCLUSTERED/gi, "UNIQUE");
  sql = stripQuotedTypes(sql);
  sql = sql.replace(/\bvarchar\s*\(\s*max\s*\)/gi, "longtext");
  sql = sql.replace(/\bnvarchar\s*\(\s*max\s*\)/gi, "longtext");
  sql = sql.replace(/\s+TEXTIMAGE_ON\s+`PRIMARY`/gi, "");
  sql = sql.replace(/\)\s*;/g, ");");
  if (!sql.trim().endsWith(";")) sql = sql.trim() + ";";
  return sql;
}

function convertCreateIndex(batch) {
  let sql = cleanCommon(batch);
  sql = sql.replace(/CREATE\s+NONCLUSTERED\s+INDEX/gi, "CREATE INDEX");
  sql = sql.replace(/CREATE\s+CLUSTERED\s+INDEX/gi, "CREATE INDEX");
  sql = sql.replace(/\s+INCLUDE\s*\([^\)]*\)/gis, "");
  /* SSMS suele emitir ")WITH (" sin espacio antes de WITH */
  sql = sql.replace(/\s*WITH\s*\([^\)]*\)/gis, "");
  sql = sql.replace(/\s+ON\s+`PRIMARY`/gi, "");
  sql = stripQuotedTypes(sql);
  sql = sql.replace(/\s+ASC\b/gi, "");
  return sql.trim().endsWith(";") ? sql.trim() : sql.trim() + ";";
}

function convertAlterDefault(batch) {
  let sql = cleanCommon(batch);
  const m = sql
    .trim()
    .match(
      /^ALTER TABLE\s+(`[^`]+`)\s+ADD\s+(?:CONSTRAINT\s+`[^`]+`\s+)?DEFAULT\s*\(\(?(.+?)\)?\)\s+FOR\s+(`[^`]+`)$/i
    );
  if (m) {
    const [, table, defaultVal, column] = m;
    return `ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${defaultVal.trim()};`;
  }
  return null;
}

function convertAlterPrimaryKey(batch) {
  let sql = cleanCommon(batch);
  sql = sql.replace(/\)\s*WITH\s*\([^\)]*\)\s*ON\s*`PRIMARY`/gis, ")");
  sql = sql.replace(/WITH\s*\([^\)]*\)/gis, "");
  sql = sql.replace(/\s+ON\s+`PRIMARY`/gi, "");
  sql = sql.replace(/PRIMARY KEY\s+NONCLUSTERED/gi, "PRIMARY KEY");
  sql = sql.replace(/PRIMARY KEY\s+CLUSTERED/gi, "PRIMARY KEY");
  sql = sql.replace(/\s+ASC\b/gi, "");
  sql = stripQuotedTypes(sql);
  sql = sql.replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  return sql.trim().endsWith(";") ? sql.trim() : sql.trim() + ";";
}

/** PK definida solo con ALTER (SQL Server) → metadatos para inyectarla en CREATE con AUTO_INCREMENT */
function extractDeferredPrimaryKeys(batchList) {
  const map = new Map();
  for (const batchRaw of batchList) {
    if (!/PRIMARY KEY\s+(NON)?CLUSTERED/i.test(batchRaw)) continue;
    const lines = batchRaw.split(/\r?\n/);
    const filtered = filterBatchLines(lines);
    if (!filtered.length) continue;
    const joined = filtered.join("\n");
    if (!filtered[0].toUpperCase().startsWith("ALTER TABLE ")) continue;
    const converted = convertAlterPrimaryKey(joined);
    const m = converted.match(
      /^ALTER TABLE `([^`]+)` ADD CONSTRAINT `([^`]+)` PRIMARY KEY \(([^)]+)\)/i
    );
    if (!m) continue;
    const cols = m[3].split(",").map((c) => c.trim().replace(/^`|`$/g, ""));
    map.set(m[1], { constraint: m[2], cols });
  }
  return map;
}

/**
 * MariaDB exige que AUTO_INCREMENT sea clave en el mismo CREATE.
 * Si la PK aplazada empieza por la columna AUTO_INCREMENT, se añade inline.
 */
function mergeCreateTableWithDeferredPk(createSql, pkMeta) {
  if (!pkMeta || /PRIMARY\s+KEY/i.test(createSql)) return createSql;
  if (!/AUTO_INCREMENT/i.test(createSql)) return createSql;
  const ai = createSql.match(/`([^`]+)`\s+[^,\n]+AUTO_INCREMENT/i);
  if (!ai) return createSql;
  const aiCol = ai[1];
  if (!pkMeta.cols.length || pkMeta.cols[0] !== aiCol) return createSql;
  const colList = pkMeta.cols.map((c) => `\`${c}\``).join(", ");
  const insert = `,CONSTRAINT \`${pkMeta.constraint}\` PRIMARY KEY (${colList})`;
  return createSql.replace(/\)\s*;\s*$/, insert + ");");
}

function convertForeignKeyBatch(batch) {
  let s = cleanCommon(batch)
    .replace(/\s+WITH\s+CHECK\s+ADD\s+/gi, " ADD ")
    .replace(/\s+WITH\s+NOCHECK\s+ADD\s+/gi, " ADD ");
  s = s.replace(/\r?\n\s*/g, " ");
  s = s.replace(/\s+/g, " ");
  s = stripQuotedTypes(s);
  return s.trim().endsWith(";") ? s.trim() : s.trim() + ";";
}

function filterBatchLines(lines) {
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const u = t.toUpperCase();
    if (u === "GO") continue;
    if (u.startsWith("SET IDENTITY_INSERT")) continue;
    if (u.startsWith("SET ANSI_")) continue;
    if (u.startsWith("SET QUOTED_IDENTIFIER")) continue;
    if (u.startsWith("SET ANSI_PADDING")) continue;
    if (t.startsWith("/******")) continue;
    out.push(t);
  }
  return out;
}

function processBatch(batchRaw, ctx) {
  const lines = batchRaw.split(/\r?\n/);
  const filtered = filterBatchLines(lines);
  if (!filtered.length) return [];

  const joined = filtered.join("\n");
  const firstU = filtered[0].toUpperCase();

  if (firstU.startsWith("INSERT ")) {
    const outs = [];
    for (const ln of mergeInsertContinuationLines(filtered)) {
      const c = convertInsertLine(ln);
      if (c) outs.push(c);
    }
    return outs;
  }

  if (firstU.startsWith("CREATE TABLE ")) {
    return [convertCreateTable(joined)];
  }

  if (
    firstU.startsWith("CREATE NONCLUSTERED INDEX ") ||
    firstU.startsWith("CREATE CLUSTERED INDEX ") ||
    firstU.startsWith("CREATE INDEX ")
  ) {
    return [convertCreateIndex(joined)];
  }

  if (firstU.startsWith("ALTER TABLE ")) {
    const checkOnly = /ALTER TABLE\s+\[?dbo\]?\.\[?[^\]]+\]?\s+CHECK\s+CONSTRAINT/i.test(joined.replace(/`/g, ""));
    if (checkOnly || /^\s*ALTER TABLE\s+`[^`]+`\s+CHECK\s+CONSTRAINT/i.test(joined)) {
      return [];
    }

    if (/PRIMARY KEY\s+(NON)?CLUSTERED/i.test(joined)) {
      const conv = convertAlterPrimaryKey(joined);
      if (ctx?.inlinedPkTables) {
        const tm = conv.match(/^ALTER TABLE `([^`]+)`/i);
        if (tm && ctx.inlinedPkTables.has(tm[1])) return [];
      }
      return [conv];
    }

    if (
      /ADD\s+CONSTRAINT.*\bCHECK\s*\(/i.test(joined) &&
      !/FOREIGN KEY/i.test(joined)
    ) {
      let s = cleanCommon(joined)
        .replace(/\s+WITH\s+CHECK\s+ADD\s+/gi, " ADD ")
        .replace(/\s+WITH\s+NOCHECK\s+ADD\s+/gi, " ADD ");
      s = s.replace(/\s+/g, " ");
      s = stripQuotedTypes(s);
      return [s.trim().replace(/;?\s*$/, "") + ";"];
    }

    if (/FOREIGN KEY\s*\(/i.test(joined)) {
      return [convertForeignKeyBatch(joined)];
    }

    const d = convertAlterDefault(joined);
    if (d) return [d];

    const outs = [];
    for (const p of filtered) {
      const one = filterBatchLines([p]);
      if (!one.length) continue;
      const dd = convertAlterDefault(one[0]);
      if (dd) outs.push(dd);
    }
    return outs;
  }

  return [];
}

const { src, dst, dbName: dbArg, usingDefaultPrestamos } = parseCli();
const text = readSqlText(src);
let dbName = dbArg;
if (!dbName) {
  if (usingDefaultPrestamos) dbName = "Prestamos";
  else dbName = inferDbNameFromSql(text) || path.basename(src, path.extname(src));
}

const execSkipRe = new RegExp(`^EXEC\\s+\\[${escapeRegex(dbName)}\\]`, "i");

const batches = text
  .split(/^\s*GO\s*$/gim)
  .map((b) => b.trim())
  .filter(Boolean);

const deferredPk = extractDeferredPrimaryKeys(batches);
const inlinedPkTables = new Set();

const out = [];
out.push("-- MariaDB 10.4.32+ (InnoDB): esquema + datos.");
out.push("-- Generado desde SQL Server; no modifica el archivo fuente.");
out.push("-- Procedimientos/funciones/vistas omitidos.");
out.push("");
out.push(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
out.push(
  `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
);
out.push(`USE \`${dbName}\`;`);
out.push("");
out.push("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;");
out.push("SET SESSION default_storage_engine = 'InnoDB';");
out.push("SET FOREIGN_KEY_CHECKS = 0;");
out.push("");

for (const batch of batches) {
  const lines = batch.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const t0 = lines.find((l) => !l.startsWith("/******"))?.toUpperCase() ?? lines[0]?.toUpperCase() ?? "";

  if (/^USE\s+\[/i.test(t0)) continue;
  if (t0.startsWith("CREATE DATABASE ")) continue;
  if (t0.startsWith("ALTER DATABASE ")) continue;
  if (t0.startsWith("IF (1 = FULLTEXTSERVICEPROPERTY")) continue;
  if (t0.startsWith("EXEC SYS.") || execSkipRe.test(t0)) continue;
  if (t0.startsWith("CREATE TYPE ")) continue;
  if (t0.startsWith("CREATE FUNCTION ")) continue;
  if (t0.startsWith("CREATE PROCEDURE ")) continue;
  if (t0.startsWith("CREATE VIEW ")) continue;

  let produced = processBatch(batch, { inlinedPkTables });
  if (produced.length === 1 && /^CREATE TABLE `/i.test(produced[0])) {
    const tm = produced[0].match(/^CREATE TABLE `([^`]+)`/i);
    if (tm) {
      const pk = deferredPk.get(tm[1]);
      const merged = mergeCreateTableWithDeferredPk(produced[0], pk);
      if (merged !== produced[0]) {
        produced = [merged];
        inlinedPkTables.add(tm[1]);
      }
    }
  }
  for (const line of produced) {
    out.push(line);
    if (!line.startsWith("INSERT INTO ")) {
      out.push("");
    }
  }
}

out.push("SET FOREIGN_KEY_CHECKS = 1;");
out.push("");

fs.writeFileSync(dst, out.join("\n"), "utf8");
console.log("Origen (solo lectura):", src);
console.log("Escrito:", dst, "líneas:", out.length);
