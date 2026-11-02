# Daily Sadaqah (ডেইলি সাদাকা) — Production-Oriented Full-Stack Platform

> **"প্রতিদিনের ছোট্ট দান, কারও জীবনে বড় পরিবর্তন।"**  
> *Small Daily Giving. Lasting Impact.*

**Daily Sadaqah** is a Bengali-first Islamic charity and community welfare full-stack platform designed for ordinary people in Bangladesh. It supports manual **Send Money** donations (`bKash` and `Nagad` personal accounts) with administrative verification, immutable financial transparency accounting, reminder-based Daily Sadaqah preferences, a privacy-first blood donor directory, and verified community help requests.

## 1. Required Software

- **Node.js**: `>= 18.18.0` (LTS recommended; tested on Windows, macOS, and Linux)
- **Package Manager**: `pnpm >= 9.x` (or `npm >= 9.x`)
- **Database**: **PostgreSQL 16** (via Docker Desktop / `docker-compose.yml` or native Windows/Linux PostgreSQL installer)

## 2. How to Install Dependencies

From the project root (`daily-sadaqah-fullstack/`):

```bash
pnpm install
```

## 3. How to Configure Environment Variables

Copy `.env.example` to `.env` in the repository root:

```bash
# Windows PowerShell:
Copy-Item .env.example .env

# macOS / Linux / Git Bash:
cp .env.example .env
```

Update `.env` with your PostgreSQL credentials, cryptographic secrets (`SESSION_SECRET`, `CSRF_SECRET`, `FILE_SIGNING_SECRET`), and receiving numbers (`BKASH_RECEIVING_NUMBER`, `NAGAD_RECEIVING_NUMBER`). Never commit `.env` to version control.

## 4. How to Start PostgreSQL

Using Docker Compose:

```bash
docker compose up -d postgres
```

## 5. How to Run Migrations

Generate the Prisma client and apply the SQL migrations in `prisma/migrations/`:

```bash
pnpm db:generate
pnpm db:migrate
```

## 6. How to Seed Sample Data

Sample seeding is strictly opt-in (`--confirm-seed`) and blocked in production (`NODE_ENV=production`) so fake financial records are never automatically inserted into a live database:

```bash
pnpm db:seed
```

This creates the 3 roles (`USER`, `ADMIN`, `MODERATOR`) and the 9 initial charitable projects (`চিকিৎসা সহায়তা`, `খাদ্য সহায়তা`, `বিশুদ্ধ পানি`, `এতিম ও শিশু সহায়তা`, `শিক্ষা সহায়তা`, `ঘর মেরামত`, `জরুরি সহায়তা`, `ইফতার ও রমজান`, `সাধারণ সাদাকা`).

## 7. How to Run the Frontend

```bash
pnpm dev:web
```

The Next.js App Router frontend runs at `http://localhost:3000`.

## 8. How to Run the Backend

```bash
pnpm dev:api
```

The REST API server runs at `http://localhost:4000`.

## 9. How to Run Tests

Execute the automated test suite (covering Authentication, Manual Donations, Transaction ID Uniqueness, Financial Accounting, Concurrency Locking, Privacy, Admin Audit Logs, and Frontend compilation):

```bash
npm test
# or:
node scripts/run-tests.mjs
```

Run TypeScript typechecking and linting:

```bash
npm run typecheck
npm run lint
```

## 10. How to Build for Production

```bash
npm run build
```

## 11. How to Configure OTP

Configure these variables in `.env`:
- `OTP_PROVIDER="console-dev"`: For local development/testing only. Strictly blocked when `NODE_ENV=production`.
- `OTP_PROVIDER="sms-gateway"`: Uses `SmsGatewayOtpProvider` (`apps/api/src/services/otp.ts`). Set `SMS_GATEWAY_API_URL`, `SMS_GATEWAY_API_KEY`, and `SMS_GATEWAY_SENDER_ID`.

## 12. How to Configure File Storage

Configure `STORAGE_DRIVER` in `.env`:
- `STORAGE_DRIVER="local"`: Stores private help request documents in `LOCAL_PRIVATE_STORAGE_DIR` (outside any public web root) and public receipts in `LOCAL_PUBLIC_STORAGE_DIR`.
- `STORAGE_DRIVER="s3"`: Uses S3-compatible object storage (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_BUCKET_PUBLIC`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`).
- Only `application/pdf`, `image/jpeg`, `image/png`, and `image/webp` up to `MAX_UPLOAD_FILE_SIZE_BYTES` (5 MB) are accepted; executable files (`.exe`, `.sh`, `.bat`, `.js`, `.php`) are rejected.

## 13. How to Configure Donation Receiving Numbers

Because Daily Sadaqah currently uses manual **Send Money** rather than a merchant gateway, configure your designated personal numbers in `.env`:

```env
BKASH_RECEIVING_NUMBER="01XXXXXXXXX"
NAGAD_RECEIVING_NUMBER="01XXXXXXXXX"
```

## 14. How to Create the First Admin Safely

There is no public admin registration page. To bootstrap the first administrator:
1. Set `ADMIN_BOOTSTRAP_ENABLED="true"`, `ADMIN_BOOTSTRAP_TOKEN="<at-least-16-char-secret>"`, and `ADMIN_INITIAL_PHONE="01XXXXXXXXX"` in `.env`.
2. Run:
   ```bash
   pnpm admin:bootstrap --token="<at-least-16-char-secret>"
   ```
3. Immediately set `ADMIN_BOOTSTRAP_ENABLED="false"` in `.env`. Once one admin exists, the bootstrap guard permanently locks further CLI bootstrap attempts.

## 15. Financial Accounting Model & Known Limitations

- **Formula**: `Remaining Balance = Verified Donations (VERIFIED) - Approved Expenses (APPROVED)`.
- `PENDING` and `REJECTED` donations are excluded from public totals.
- `PENDING` and `REJECTED` expenses are excluded from public totals.
- **Limitations**:
  1. Personal `bKash`/`Nagad` Send Money transactions cannot be verified automatically without merchant webhook APIs; verification is performed manually by administrators in `/admin`.
  2. Daily Sadaqah is a reminder and streak-tracking preference system; it never auto-debits user accounts, and external SMS reminder delivery requires configuring `SMS_GATEWAY_*` credentials.
  3. Financial summaries reflect internal database records verified by platform administrators and do not constitute an external third-party statutory audit.

## 16. Free Cloud Deployment Guide (Vercel + NeonDB / Supabase)

### Step 1: Create a Free PostgreSQL Database (NeonDB or Supabase)
1. Go to [Neon.tech](https://neon.tech) (recommended, 100% free serverless PostgreSQL) or [Supabase.com](https://supabase.com).
2. Create a free project and copy your database connection string (`DATABASE_URL`).
3. Push schema and seed initial data in one step:
   ```bash
   pnpm db:push "your-neon-or-supabase-database-url"
   ```

### Step 2: Deploy to Vercel
1. Install and login to Vercel CLI:
   ```bash
   vercel login
   ```
2. Deploy the project:
   ```bash
   vercel --prod
   ```
3. Set your production environment variables in your Vercel Project Settings (reference: `.env.production.example`):
   - `DATABASE_URL`: Your Neon or Supabase PostgreSQL connection string
   - `SESSION_SECRET`: 32+ character random string
   - `CSRF_SECRET`: 32+ character random string
   - `BKASH_RECEIVING_NUMBER`: `01681253714`
   - `NAGAD_RECEIVING_NUMBER`: `01681253714`
