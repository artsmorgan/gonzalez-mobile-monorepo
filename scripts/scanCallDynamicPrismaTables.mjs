import fs from 'fs';
import path from 'path';

const root = process.cwd();

const targetDirs = [
  path.join(root, 'apps', 'server', 'app', 'api'),
  path.join(root, 'apps', 'server', 'utils'),
];

async function* walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      yield fullPath;
    }
  }
}

async function main() {
  const tables = new Set();
  const files = [];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    for await (const filePath of walk(dir)) {
      files.push(filePath);
    }
  }

  for (const filePath of files) {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const regex = /table\s*:\s*"([^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      tables.add(match[1]);
    }
  }

  const sorted = Array.from(tables).sort((a, b) => a.localeCompare(b));
  console.log('Tables used via callDynamicPrisma (api + utils):');
  for (const t of sorted) {
    console.log(t);
  }
}

main().catch((err) => {
  console.error('Error scanning tables:', err);
  process.exit(1);
});

