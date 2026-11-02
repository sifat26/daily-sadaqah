import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function walkFiles(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.next', 'storage'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(walkFiles(full));
    } else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...walkFiles(path.join(ROOT, 'packages')),
  ...walkFiles(path.join(ROOT, 'apps')),
  ...walkFiles(path.join(ROOT, 'prisma')),
];

let violations = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  if (/\/\/\s*TODO:/i.test(src) || /\/\/\s*FIXME:/i.test(src)) {
    console.error(`[Lint Error] Unresolved TODO/FIXME in ${rel}`);
    violations += 1;
  }
  if (/NEXT_PUBLIC_[A-Z0-9_]*SECRET/i.test(src)) {
    console.error(`[Security Lint Error] Secret exposed via NEXT_PUBLIC_ in ${rel}`);
    violations += 1;
  }
}

if (violations > 0) {
  process.exit(1);
}
console.log(`[Lint] Clean pass across ${files.length} files (0 warnings, 0 errors).`);
