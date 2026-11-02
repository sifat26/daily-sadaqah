// ============================================================================
// Daily Sadaqah — One-Click Cloud Database Deployer (NeonDB / Supabase)
// Usage: node scripts/deploy-db.mjs [DATABASE_URL]
// ============================================================================

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const customUrl = process.argv[2];

if (customUrl) {
  process.env.DATABASE_URL = customUrl;
  console.log('[Deploy DB] Using DATABASE_URL provided via argument.');
} else if (!process.env.DATABASE_URL) {
  // Try loading from .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
      if (match) {
        process.env.DATABASE_URL = match[1];
        break;
      }
    }
  }
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('sadaqah_local_dev_password')) {
  console.log('\n[Daily Sadaqah Cloud Database Setup]');
  console.log('--------------------------------------------------');
  console.log('To connect to NeonDB or Supabase:');
  console.log('1. Create a free project at https://neon.tech or https://supabase.com');
  console.log('2. Copy your PostgreSQL connection string.');
  console.log('3. Run:');
  console.log('   node scripts/deploy-db.mjs "postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require"\n');
  process.exit(1);
}

console.log('[Deploy DB] Pushing Prisma schema to cloud PostgreSQL database...');
try {
  execSync('npx prisma db push --schema=prisma/schema.prisma --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('\n[Deploy DB] SUCCESS! All tables, indexes, and enums have been created in your database.');
  console.log('[Deploy DB] Generating Prisma Client...');
  execSync('npx prisma generate --schema=prisma/schema.prisma', {
    stdio: 'inherit',
    env: process.env,
  });
  console.log('\n[Deploy DB] Database is 100% ready for production deployment!');
} catch (error) {
  console.error('\n[Deploy DB] Error connecting or pushing to database:', error.message);
  process.exit(1);
}

