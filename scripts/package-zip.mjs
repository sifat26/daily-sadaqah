import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const zipName = 'daily-sadaqah-fullstack.zip';
const cmd = `tar -a -c -f "${zipName}" --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git --exclude=storage --exclude="*.zip" apps packages prisma scripts package.json pnpm-lock.yaml pnpm-workspace.yaml docker-compose.yml .env.example .gitignore LICENSE README.md`;

console.log('[Packaging] Creating ZIP archive:', zipName);
execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
console.log('[Packaging] Completed successfully: ' + path.join(ROOT, zipName));

