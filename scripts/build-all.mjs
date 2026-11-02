import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(ROOT, 'dist');

function compileDirectory(srcDir, outDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.next'].includes(entry.name)) continue;
    const fullSrc = path.join(srcDir, entry.name);
    const fullOut = path.join(outDir, entry.name);
    if (entry.isDirectory()) {
      count += compileDirectory(fullSrc, fullOut);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      const code = fs.readFileSync(fullSrc, 'utf8');
      const res = ts.transpileModule(code, {
        fileName: fullSrc,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      });
      const outJs = fullOut.replace(/\.(ts|tsx)$/, '.js');
      fs.mkdirSync(path.dirname(outJs), { recursive: true });
      fs.writeFileSync(outJs, res.outputText, 'utf8');
      count += 1;
    }
  }
  return count;
}

fs.rmSync(DIST_ROOT, { recursive: true, force: true });
const cShared = compileDirectory(
  path.join(ROOT, 'packages/shared'),
  path.join(DIST_ROOT, 'packages/shared')
);
const cPrisma = compileDirectory(
  path.join(ROOT, 'prisma'),
  path.join(DIST_ROOT, 'prisma')
);
const cApi = compileDirectory(
  path.join(ROOT, 'apps/api'),
  path.join(DIST_ROOT, 'apps/api')
);
const cWeb = compileDirectory(
  path.join(ROOT, 'apps/web'),
  path.join(DIST_ROOT, 'apps/web')
);

console.log(
  `[Build] Production build succeeded: shared=${cShared}, prisma=${cPrisma}, api=${cApi}, web=${cWeb} modules compiled to dist/.`
);
