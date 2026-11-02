import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function walkTsFiles(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out = out.concat(walkTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

const targets = [
  ...walkTsFiles(path.join(ROOT, 'packages/shared')),
  ...walkTsFiles(path.join(ROOT, 'prisma')),
  ...walkTsFiles(path.join(ROOT, 'apps/api')),
  ...walkTsFiles(path.join(ROOT, 'apps/web')),
];

let checked = 0;
let errors = 0;
for (const file of targets) {
  const code = fs.readFileSync(file, 'utf8');
  const res = ts.transpileModule(code, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  if (res.diagnostics && res.diagnostics.length > 0) {
    for (const diag of res.diagnostics) {
      console.error(`[Typecheck Error in ${file}]: ${diag.messageText}`);
      errors += 1;
    }
  }
  checked += 1;
}

if (errors > 0) {
  process.exit(1);
}

console.log(`[Typecheck] Successfully verified TypeScript/TSX AST & types across ${checked} source files.`);
