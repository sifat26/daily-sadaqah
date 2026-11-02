// ============================================================================
// Daily Sadaqah — Backend REST API Application (apps/api/src/app.ts)
// Implements full authentication, manual donation verification, financial
// transparency accounting, Daily Sadaqah, blood donors, help requests,
// RBAC, rate limiting, security headers, and audit logging.
// ============================================================================

import crypto from 'crypto';
import http from 'http';
import { URL } from 'url';
import { AppEnvConfig, loadEnvConfig } from './config/env';
import {
  SchemaValidationError,
  validateBloodDonorInput,
  validateCreateDonationInput,
  validateCreateExpenseInput,
  validateCreateHelpRequestInput,
  validateDailySadaqahInput,
  validateOtpRequestInput,
  validateOtpVerifyInput,
  validateUpsertProjectInput,
} from '../../../packages/shared/src/schemas/index';
import { TransactionalDatabase, UserRecord } from './services/db';
import { createOtpProvider, generateSixDigitOtp, hashOtpCode } from './services/otp';
import { FileStorageService } from './services/storage';

export interface ApiServerContext {
  config: AppEnvConfig;
  db: TransactionalDatabase;
  storage: FileStorageService;
  handleRequest: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return 'গোপন নম্বর';
  return phone.slice(0, 6) + '*****' + phone.slice(-2);
}

export function createApiServer(
  customConfig?: Partial<AppEnvConfig>,
  seedSample = true
): ApiServerContext {
  const config = loadEnvConfig(customConfig);
  const db = new TransactionalDatabase(seedSample);
  const otpProvider = createOtpProvider(config);
  const storage = new FileStorageService(config);

  // Per-phone OTP request rate limit counter
  const otpRateLimitMap = new Map<string, { count: number; windowResetAt: number }>();

  function checkOtpRateLimit(phone: string): void {
    const now = Date.now();
    const entry = otpRateLimitMap.get(phone);
    if (!entry || now > entry.windowResetAt) {
      otpRateLimitMap.set(phone, { count: 1, windowResetAt: now + 60_000 });
      return;
    }
    if (entry.count >= 3) {
      throw new Error('RATE_LIMIT_EXCEEDED: অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার OTP অনুরোধ করুন।');
    }
    entry.count += 1;
  }

  function authenticateRequest(req: http.IncomingMessage): {
    user: UserRecord | null;
    sessionId: string | null;
    csrfToken: string | null;
  } {
    const cookies = parseCookies(req.headers.cookie);
    const rawToken =
      cookies[config.sessionCookieName] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : '');

    if (!rawToken) {
      return { user: null, sessionId: null, csrfToken: null };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = db.sessions.get(tokenHash);
    if (!session || session.revokedAt !== null || Date.now() > session.expiresAt) {
      return { user: null, sessionId: null, csrfToken: null };
    }

    const user = db.users.get(session.userId) || null;
    if (!user || user.status !== 'ACTIVE') {
      return { user: null, sessionId: null, csrfToken: null };
    }

    return { user, sessionId: session.id, csrfToken: session.csrfToken };
  }

  function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown, extraHeaders: Record<string, string> = {}): void {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    });
    res.end(body);
  }

  async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > config.maxUploadFileSizeBytes + 65536) {
          reject(new Error('PAYLOAD_TOO_LARGE: Request body exceeds allowed size.'));
        }
      });
      req.on('end', () => {
        if (!raw.trim()) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('INVALID_JSON: Request body must be valid JSON.'));
        }
      });
      req.on('error', reject);
    });
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = (req.method || 'GET').toUpperCase();
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '') || '/';

    // CORS headers
    const origin = req.headers.origin;
    if (origin && config.corsAllowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
    }

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const auth = authenticateRequest(req);

    try {
      // ======================================================================
      // 1. AUTHENTICATION ENDPOINTS
      // ======================================================================
      if (method === 'POST' && pathname === '/api/auth/request-otp') {
        const body = await readJsonBody(req);
        const { phone } = validateOtpRequestInput(body);
        checkOtpRateLimit(phone);

        const otpCode = generateSixDigitOtp();
        const otpHash = hashOtpCode(phone, otpCode, config.sessionSecret);
        const expiresAt = Date.now() + config.otpExpirySeconds * 1000;

        db.otps.set(phone, {
          id: `otp_${crypto.randomUUID()}`,
          phone,
          otpHash,
          attempts: 0,
          maxAttempts: config.otpMaxAttempts,
          expiresAt,
          verifiedAt: null,
        });

        const dispatch = await otpProvider.sendOtp(phone, otpCode);
        sendJson(res, 200, {
          success: true,
          data: {
            phone,
            expiresInSeconds: config.otpExpirySeconds,
            message: 'আপনার মোবাইল নম্বরে ৬ সংখ্যার OTP পাঠানো হয়েছে।',
            ...(config.nodeEnv !== 'production' && dispatch.devOtpPreview
              ? { devOtp: dispatch.devOtpPreview }
              : {}),
          },
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/verify-otp') {
        const body = await readJsonBody(req);
        const { phone, otp, name } = validateOtpVerifyInput(body);
        const record = db.otps.get(phone);

        if (!record || record.verifiedAt !== null) {
          sendJson(res, 400, {
            success: false,
            error: { code: 'OTP_NOT_FOUND', message: 'কোনো সক্রিয় OTP পাওয়া যায়নি। নতুন OTP অনুরোধ করুন।' },
          });
          return;
        }

        if (Date.now() > record.expiresAt) {
          sendJson(res, 400, {
            success: false,
            error: { code: 'OTP_EXPIRED', message: 'OTP-এর মেয়াদ শেষ হয়ে গেছে। আবার চেষ্টা করুন।' },
          });
          return;
        }

        if (record.attempts >= record.maxAttempts) {
          sendJson(res, 429, {
            success: false,
            error: {
              code: 'OTP_MAX_ATTEMPTS',
              message: 'সর্বোচ্চ সংখ্যক ভুল প্রচেষ্টার কারণে এই OTP বাতিল হয়েছে।',
            },
          });
          return;
        }

        const expectedHash = hashOtpCode(phone, otp, config.sessionSecret);
        if (expectedHash !== record.otpHash) {
          record.attempts += 1;
          sendJson(res, 401, {
            success: false,
            error: { code: 'INVALID_OTP', message: 'ভুল OTP কোড। আবার যাচাই করুন।' },
          });
          return;
        }

        record.verifiedAt = Date.now();

        // Find or create user
        let user = Array.from(db.users.values()).find((u) => u.phone === phone);
        if (!user) {
          user = {
            id: `usr_${crypto.randomUUID()}`,
            phone,
            name: name || 'সম্মানিত দাতা',
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          };
          db.users.set(user.id, user);
        } else if (name) {
          user.name = name;
        }

        const rawSessionToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawSessionToken).digest('hex');
        const csrfToken = crypto.randomBytes(24).toString('hex');
        const expiresAt = Date.now() + config.sessionTtlHours * 3600 * 1000;

        db.sessions.set(tokenHash, {
          id: `ses_${crypto.randomUUID()}`,
          tokenHash,
          csrfToken,
          userId: user.id,
          expiresAt,
          revokedAt: null,
        });

        const cookieFlags = [
          `${config.sessionCookieName}=${encodeURIComponent(rawSessionToken)}`,
          'Path=/',
          'HttpOnly',
          'SameSite=Lax',
          `Max-Age=${config.sessionTtlHours * 3600}`,
        ];
        if (config.nodeEnv === 'production') {
          cookieFlags.push('Secure');
        }

        sendJson(
          res,
          200,
          {
            success: true,
            data: {
              user,
              csrfToken,
              sessionToken: rawSessionToken,
            },
          },
          { 'Set-Cookie': cookieFlags.join('; ') }
        );
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        const cookies = parseCookies(req.headers.cookie);
        const rawToken =
          cookies[config.sessionCookieName] ||
          (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7).trim()
            : '');
        if (rawToken) {
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const session = db.sessions.get(tokenHash);
          if (session) {
            session.revokedAt = Date.now();
          }
        }
        sendJson(
          res,
          200,
          { success: true, data: { message: 'সফলভাবে লগআউট সম্পন্ন হয়েছে।' } },
          {
            'Set-Cookie': `${config.sessionCookieName}=; Path=/; HttpOnly; Max-Age=0`,
          }
        );
        return;
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        sendJson(res, 200, {
          success: true,
          data: { user: auth.user, csrfToken: auth.csrfToken },
        });
        return;
      }

      // ======================================================================
      // 2. PUBLIC PROJECTS ENDPOINTS
      // ======================================================================
      if (method === 'GET' && pathname === '/api/projects') {
        const categoryFilter = parsedUrl.searchParams.get('category');
        const includeAllStatuses =
          parsedUrl.searchParams.get('all') === 'true' && auth.user?.role === 'ADMIN';

        const list = Array.from(db.projects.values()).filter((p) => {
          if (!includeAllStatuses && p.status !== 'ACTIVE') return false;
          if (categoryFilter && p.category !== categoryFilter) return false;
          return true;
        });

        sendJson(res, 200, { success: true, data: list });
        return;
      }

      if (method === 'GET' && pathname.startsWith('/api/projects/')) {
        const slugOrId = decodeURIComponent(pathname.replace('/api/projects/', ''));
        const proj = Array.from(db.projects.values()).find(
          (p) => p.slug === slugOrId || p.id === slugOrId
        );
        if (!proj) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'PROJECT_NOT_FOUND', message: 'প্রকল্পটি খুঁজে পাওয়া যায়নি।' },
          });
          return;
        }
        sendJson(res, 200, { success: true, data: proj });
        return;
      }

      // ======================================================================
      // 3. MANUAL DONATION ENDPOINTS
      // ======================================================================
      if (method === 'POST' && pathname === '/api/donations') {
        const body = await readJsonBody(req);
        const input = validateCreateDonationInput(body);

        const created = await db.$transaction(async (tx) => {
          const project = tx.projects.get(input.projectId);
          if (!project || project.status !== 'ACTIVE') {
            throw new Error('INVALID_PROJECT: নির্বাচিত প্রকল্পটি বর্তমানে সক্রিয় নয়।');
          }
          if (tx.transactionIdIndex.has(input.transactionId)) {
            throw new Error(
              'DUPLICATE_TRANSACTION_ID: এই Transaction ID ইতিমধ্যে জমা দেওয়া হয়েছে।'
            );
          }

          tx.transactionIdIndex.add(input.transactionId);

          const donation = {
            id: `don_${crypto.randomUUID()}`,
            userId: auth.user ? auth.user.id : null,
            projectId: project.id,
            projectName: project.name,
            senderPhone: input.senderPhone,
            donorName: input.isAnonymous
              ? 'নাম প্রকাশে অনিচ্ছুক'
              : input.donorName || auth.user?.name || 'সম্মানিত দাতা',
            isAnonymous: input.isAnonymous,
            amountBdt: input.amountBdt,
            provider: input.provider,
            transactionId: input.transactionId,
            message: input.message,
            isDailySadaqah: input.isDailySadaqah,
            status: 'PENDING' as const,
            createdAt: new Date().toISOString(),
          };

          tx.donations.set(donation.id, donation);
          return donation;
        });

        sendJson(res, 201, {
          success: true,
          data: {
            donation: created,
            message:
              'আপনার দানের তথ্য জমা হয়েছে (অবস্থা: যাচাই চলছে)। অ্যাডমিন যাচাই সম্পন্ন করলে মূল হিসাবে যুক্ত হবে।',
          },
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/donations/my') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const page = Math.max(1, Number(parsedUrl.searchParams.get('page') || 1));
        const pageSize = Math.min(50, Math.max(1, Number(parsedUrl.searchParams.get('pageSize') || 20)));

        const allMine = Array.from(db.donations.values()).filter(
          (d) => d.userId === auth.user!.id
        );
        const start = (page - 1) * pageSize;
        const paged = allMine.slice(start, start + pageSize);

        const totalVerifiedBdt = allMine
          .filter((d) => d.status === 'VERIFIED')
          .reduce((sum, d) => sum + d.amountBdt, 0);
        const totalPendingBdt = allMine
          .filter((d) => d.status === 'PENDING')
          .reduce((sum, d) => sum + d.amountBdt, 0);

        sendJson(res, 200, {
          success: true,
          data: {
            donations: paged,
            summary: {
              totalVerifiedBdt,
              totalPendingBdt,
              verifiedCount: allMine.filter((d) => d.status === 'VERIFIED').length,
              pendingCount: allMine.filter((d) => d.status === 'PENDING').length,
            },
          },
          meta: {
            page,
            pageSize,
            total: allMine.length,
            totalPages: Math.ceil(allMine.length / pageSize) || 1,
          },
        });
        return;
      }

      if (method === 'GET' && pathname.startsWith('/api/donations/')) {
        const donId = decodeURIComponent(pathname.replace('/api/donations/', ''));
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const don = db.donations.get(donId);
        if (!don) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'NOT_FOUND', message: 'দানের তথ্য পাওয়া যায়নি।' },
          });
          return;
        }
        if (don.userId !== auth.user.id && auth.user.role !== 'ADMIN') {
          sendJson(res, 403, {
            success: false,
            error: { code: 'FORBIDDEN', message: 'অন্য ব্যবহারকারীর দানের তথ্য দেখার অনুমতি নেই।' },
          });
          return;
        }
        sendJson(res, 200, { success: true, data: don });
        return;
      }

      // ======================================================================
      // 4. DAILY SADAQAH PREFERENCES
      // ======================================================================
      if (pathname === '/api/daily-sadaqah/me') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }

        if (method === 'GET') {
          const pref = db.dailyPrefs.get(auth.user.id) || {
            id: `dsp_default_${auth.user.id}`,
            userId: auth.user.id,
            projectId: 'proj_general',
            amountBdt: 10,
            enabled: true,
            reminderTime: '09:00',
            currentStreak: 0,
            updatedAt: new Date().toISOString(),
          };
          const verifiedDailyContributionsBdt = Array.from(db.donations.values())
            .filter(
              (d) =>
                d.userId === auth.user!.id &&
                d.status === 'VERIFIED' &&
                d.isDailySadaqah
            )
            .reduce((sum, d) => sum + d.amountBdt, 0);

          sendJson(res, 200, {
            success: true,
            data: {
              preference: pref,
              verifiedDailyContributionsBdt,
              notice:
                'দৈনিক সাদাকা শুধুমাত্র রিমাইন্ডার-ভিত্তিক। কোনো অটোমেটিক টাকা কাটা হয় না; শুধুমাত্র যাচাইকৃত দান মূল হিসাবে গণ্য হয়।',
            },
          });
          return;
        }

        if (method === 'PUT') {
          const body = await readJsonBody(req);
          const input = validateDailySadaqahInput(body);
          const existing = db.dailyPrefs.get(auth.user.id);
          const updated = {
            id: existing?.id || `dsp_${crypto.randomUUID()}`,
            userId: auth.user.id,
            projectId: input.projectId,
            amountBdt: input.amountBdt,
            enabled: input.enabled,
            reminderTime: input.reminderTime,
            currentStreak: existing?.currentStreak || 0,
            updatedAt: new Date().toISOString(),
          };
          db.dailyPrefs.set(auth.user.id, updated);
          sendJson(res, 200, {
            success: true,
            data: {
              preference: updated,
              message: 'আপনার দৈনিক সাদাকা সেটিংস সংরক্ষিত হয়েছে।',
            },
          });
          return;
        }
      }

      // ======================================================================
      // 5. FINANCIAL TRANSPARENCY ENDPOINTS
      // ======================================================================
      if (method === 'GET' && pathname === '/api/transparency/summary') {
        const allDonations = Array.from(db.donations.values());
        const verifiedDonations = allDonations.filter((d) => d.status === 'VERIFIED');
        const pendingDonations = allDonations.filter((d) => d.status === 'PENDING');

        const allExpenses = Array.from(db.expenses.values());
        const approvedExpenses = allExpenses.filter((e) => e.status === 'APPROVED');

        const totalVerifiedDonationsBdt = verifiedDonations.reduce(
          (sum, d) => sum + d.amountBdt,
          0
        );
        const totalApprovedExpensesBdt = approvedExpenses.reduce(
          (sum, e) => sum + e.amountBdt,
          0
        );
        const remainingBalanceBdt = totalVerifiedDonationsBdt - totalApprovedExpensesBdt;

        const projectAllocations = Array.from(db.projects.values()).map((p) => {
          const projDonated = verifiedDonations
            .filter((d) => d.projectId === p.id)
            .reduce((s, d) => s + d.amountBdt, 0);
          const projExp = approvedExpenses
            .filter((e) => e.projectId === p.id)
            .reduce((s, e) => s + e.amountBdt, 0);
          return {
            projectId: p.id,
            projectName: p.name,
            verifiedDonationsBdt: projDonated,
            approvedExpensesBdt: projExp,
          };
        });

        sendJson(res, 200, {
          success: true,
          data: {
            totalVerifiedDonationsBdt,
            totalApprovedExpensesBdt,
            remainingBalanceBdt,
            pendingDonationsCount: pendingDonations.length,
            verifiedDonationsCount: verifiedDonations.length,
            approvedExpensesCount: approvedExpenses.length,
            receivingNumbers: {
              bkash: config.bkashReceivingNumber,
              nagad: config.nagadReceivingNumber,
            },
            monthlyReport: [
              {
                month: 'অক্টোবর ২০২৬',
                donationsBdt: totalVerifiedDonationsBdt,
                expensesBdt: totalApprovedExpensesBdt,
              },
            ],
            projectAllocations,
          },
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/transparency/expenses') {
        // Public endpoint exposes ONLY APPROVED and publicDisclosure=true records, without private recipient details
        const publicExpenses = Array.from(db.expenses.values())
          .filter((e) => e.status === 'APPROVED' && e.publicDisclosure)
          .map((e) => ({
            id: e.id,
            projectId: e.projectId,
            projectName: e.projectName,
            category: e.category,
            amountBdt: e.amountBdt,
            expenseDate: e.expenseDate,
            purpose: e.purpose,
            evidence:
              e.evidence && e.evidence.publicDisclosure
                ? {
                    fileName: e.evidence.fileName,
                    mimeType: e.evidence.mimeType,
                  }
                : null,
          }));

        sendJson(res, 200, { success: true, data: publicExpenses });
        return;
      }

      // ======================================================================
      // 6. BLOOD DONOR ENDPOINTS (Strict Privacy Enforcement)
      // ======================================================================
      if (method === 'GET' && pathname === '/api/blood-donors') {
        const bloodGroup = parsedUrl.searchParams.get('bloodGroup') || '';
        const district = parsedUrl.searchParams.get('district') || '';
        const area = (parsedUrl.searchParams.get('area') || '').toLowerCase();

        const publicDonors = Array.from(db.bloodDonors.values())
          .filter((b) => {
            if (!b.isActive) return false;
            if (bloodGroup && b.bloodGroup !== bloodGroup) return false;
            if (district && b.district !== district) return false;
            if (
              area &&
              !b.area.toLowerCase().includes(area) &&
              !b.district.toLowerCase().includes(area)
            ) {
              return false;
            }
            return true;
          })
          .map((b) => ({
            id: b.id,
            displayName: b.displayName,
            bloodGroup: b.bloodGroup,
            district: b.district,
            area: b.area,
            // PRIVACY RULE: Hide phone number unless explicit consent is true
            contactPhone: b.publicPhoneConsent ? b.contactPhone : null,
            maskedPhone: maskPhone(b.contactPhone),
            publicPhoneConsent: b.publicPhoneConsent,
            lastDonationDate: b.lastDonationDate || null,
            estimatedNextDate: b.estimatedNextDate || null,
            isAvailable: b.isAvailable,
            notes: b.notes || null,
            medicalDisclaimer:
              'পরবর্তী রক্তদানের তারিখটি শুধুমাত্র আনুমানিক হিসাব; এটি চিকিৎসাগত যোগ্যতার সনদ নয়।',
          }));

        sendJson(res, 200, { success: true, data: publicDonors });
        return;
      }

      if (method === 'POST' && pathname === '/api/blood-donors') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'রক্তদাতা নিবন্ধনের জন্য লগইন করুন।' },
          });
          return;
        }
        const body = await readJsonBody(req);
        const input = validateBloodDonorInput(body);

        let estimatedNextDate: string | undefined;
        if (input.lastDonationDate) {
          const lastMs = Date.parse(input.lastDonationDate);
          if (!Number.isNaN(lastMs)) {
            estimatedNextDate = new Date(lastMs + 120 * 24 * 3600 * 1000)
              .toISOString()
              .slice(0, 10);
          }
        }

        const existing = Array.from(db.bloodDonors.values()).find(
          (d) => d.userId === auth.user!.id
        );
        const record = {
          id: existing?.id || `bd_${crypto.randomUUID()}`,
          userId: auth.user.id,
          displayName: input.displayName,
          bloodGroup: input.bloodGroup,
          district: input.district,
          area: input.area,
          contactPhone: input.contactPhone,
          publicPhoneConsent: input.publicPhoneConsent,
          lastDonationDate: input.lastDonationDate,
          estimatedNextDate,
          isAvailable: input.isAvailable,
          isActive: input.isActive,
          notes: input.notes,
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        db.bloodDonors.set(record.id, record);
        sendJson(res, 201, { success: true, data: record });
        return;
      }

      if (method === 'GET' && pathname === '/api/blood-donors/me') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const existing = Array.from(db.bloodDonors.values()).find(
          (d) => d.userId === auth.user!.id
        );
        sendJson(res, 200, { success: true, data: existing || null });
        return;
      }

      if (method === 'PATCH' && pathname === '/api/blood-donors/me') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const existing = Array.from(db.bloodDonors.values()).find(
          (d) => d.userId === auth.user!.id
        );
        if (!existing) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'NOT_FOUND', message: 'আপনার রক্তদাতা প্রোফাইল পাওয়া যায়নি।' },
          });
          return;
        }
        const body = await readJsonBody(req);
        if (body.isAvailable !== undefined) existing.isAvailable = Boolean(body.isAvailable);
        if (body.isActive !== undefined) existing.isActive = Boolean(body.isActive);
        if (body.publicPhoneConsent !== undefined) {
          existing.publicPhoneConsent = Boolean(body.publicPhoneConsent);
        }
        sendJson(res, 200, { success: true, data: existing });
        return;
      }

      // ======================================================================
      // 7. COMMUNITY HELP REQUESTS ENDPOINTS
      // ======================================================================
      if (method === 'GET' && pathname === '/api/help-requests') {
        const category = parsedUrl.searchParams.get('category') || '';
        // Public list ONLY shows VERIFIED + publicVisibility=true requests, and NEVER exposes private documents or raw phone numbers
        const list = Array.from(db.helpRequests.values())
          .filter((h) => {
            if (h.status !== 'VERIFIED' || !h.publicVisibility) return false;
            if (category && h.category !== category) return false;
            return true;
          })
          .map((h) => ({
            id: h.id,
            title: h.title,
            description: h.description,
            category: h.category,
            district: h.district,
            area: h.area,
            requiredAmountBdt: h.requiredAmountBdt,
            applicantName: h.applicantName,
            status: h.status,
            createdAt: h.createdAt,
          }));

        sendJson(res, 200, { success: true, data: list });
        return;
      }

      if (method === 'POST' && pathname === '/api/help-requests') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'সাহায্যের আবেদন জমা দিতে লগইন করুন।' },
          });
          return;
        }
        const body = await readJsonBody(req);
        const input = validateCreateHelpRequestInput(body);

        const docs: Array<{
          id: string;
          fileKey: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          isPrivate: boolean;
        }> = [];

        if (input.document) {
          const saved = storage.saveFile({
            fileName: input.document.fileName,
            mimeType: input.document.mimeType,
            sizeBytes: input.document.sizeBytes,
            base64Content: input.document.base64Content,
            isPrivate: true,
          });
          docs.push({
            id: `hr_doc_${crypto.randomUUID()}`,
            ...saved,
          });
        }

        const created = {
          id: `hr_${crypto.randomUUID()}`,
          applicantId: auth.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          district: input.district,
          area: input.area,
          requiredAmountBdt: input.requiredAmountBdt,
          applicantName: input.applicantName,
          applicantPhone: input.applicantPhone,
          status: 'PENDING' as const,
          publicVisibility: false,
          documents: docs,
          createdAt: new Date().toISOString(),
        };

        db.helpRequests.set(created.id, created);
        sendJson(res, 201, {
          success: true,
          data: {
            helpRequest: created,
            message:
              'আপনার সাহায্যের আবেদন জমা হয়েছে। অ্যাডমিন যাচাই করার পর তা প্রকাশ করা হবে।',
          },
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/help-requests/my') {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const mine = Array.from(db.helpRequests.values()).filter(
          (h) => h.applicantId === auth.user!.id
        );
        sendJson(res, 200, { success: true, data: mine });
        return;
      }

      // ======================================================================
      // 8. PRIVATE DOCUMENT ACCESS ENDPOINT (Strict Authorization)
      // ======================================================================
      if (method === 'GET' && pathname.startsWith('/api/files/private/')) {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অনুগ্রহ করে লগইন করুন।' },
          });
          return;
        }
        const docId = decodeURIComponent(pathname.replace('/api/files/private/', ''));
        let foundOwnerId: string | null = null;
        let foundDoc: { id: string; fileKey: string; fileName: string; mimeType: string } | null =
          null;

        for (const hr of db.helpRequests.values()) {
          const d = hr.documents.find((doc) => doc.id === docId || doc.fileKey === docId);
          if (d) {
            foundOwnerId = hr.applicantId;
            foundDoc = d;
            break;
          }
        }

        if (!foundDoc) {
          sendJson(res, 404, {
            success: false,
            error: { code: 'FILE_NOT_FOUND', message: 'ডকুমেন্ট পাওয়া যায়নি।' },
          });
          return;
        }

        if (auth.user.role !== 'ADMIN' && auth.user.id !== foundOwnerId) {
          sendJson(res, 403, {
            success: false,
            error: {
              code: 'FORBIDDEN_PRIVATE_DOCUMENT',
              message: 'ব্যক্তিগত ডকুমেন্ট দেখার অনুমতি আপনার নেই।',
            },
          });
          return;
        }

        const signedToken = storage.createSignedToken(foundDoc.fileKey, auth.user.id, 300);
        sendJson(res, 200, {
          success: true,
          data: {
            document: foundDoc,
            signedDownloadToken: signedToken,
          },
        });
        return;
      }

      // ======================================================================
      // 9. ADMIN DASHBOARD ENDPOINTS (Strict RBAC Check)
      // ======================================================================
      if (pathname.startsWith('/api/admin')) {
        if (!auth.user) {
          sendJson(res, 401, {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'অ্যাডমিন প্যানেলে প্রবেশের জন্য লগইন করুন।' },
          });
          return;
        }
        if (auth.user.role !== 'ADMIN') {
          sendJson(res, 403, {
            success: false,
            error: {
              code: 'FORBIDDEN_ADMIN_ONLY',
              message: 'শুধুমাত্র অনুমোদিত অ্যাডমিন এই কার্যক্রম পরিচালনা করতে পারবেন।',
            },
          });
          return;
        }

        // GET /api/admin/donations
        if (method === 'GET' && pathname === '/api/admin/donations') {
          const statusFilter = parsedUrl.searchParams.get('status') || '';
          const search = (parsedUrl.searchParams.get('search') || '').toLowerCase();

          const list = Array.from(db.donations.values()).filter((d) => {
            if (statusFilter && d.status !== statusFilter) return false;
            if (
              search &&
              !d.transactionId.toLowerCase().includes(search) &&
              !d.senderPhone.toLowerCase().includes(search) &&
              !d.donorName.toLowerCase().includes(search)
            ) {
              return false;
            }
            return true;
          });

          sendJson(res, 200, { success: true, data: list });
          return;
        }

        // POST /api/admin/donations/:id/approve
        const approveMatch = pathname.match(/^\/api\/admin\/donations\/([^/]+)\/approve$/);
        if (method === 'POST' && approveMatch) {
          const donationId = decodeURIComponent(approveMatch[1]);
          const body = await readJsonBody(req);

          const updated = await db.$transaction(async (tx) => {
            const don = tx.donations.get(donationId);
            if (!don) {
              throw new Error('DONATION_NOT_FOUND: দানের রেকর্ড পাওয়া যায়নি।');
            }
            if (don.status !== 'PENDING') {
              throw new Error(
                `ALREADY_PROCESSED: এই দানটি ইতিমধ্যে ${don.status} অবস্থায় রয়েছে।`
              );
            }

            don.status = 'VERIFIED';
            don.verifiedByAdminId = auth.user!.id;
            don.verifiedAt = new Date().toISOString();
            don.verificationNotes =
              typeof body.notes === 'string' ? body.notes.trim() : 'অ্যাডমিন কর্তৃক যাচাইকৃত';

            const project = tx.projects.get(don.projectId);
            if (project) {
              project.collectedBdt += don.amountBdt;
            }

            tx.recordAudit(auth.user!.id, 'DONATION_APPROVED', 'Donation', don.id, {
              transactionId: don.transactionId,
              amountBdt: don.amountBdt,
              projectId: don.projectId,
            });

            return don;
          });

          sendJson(res, 200, {
            success: true,
            data: {
              donation: updated,
              message: 'দানটি সফলভাবে যাচাই ও অনুমোদন করা হয়েছে।',
            },
          });
          return;
        }

        // POST /api/admin/donations/:id/reject
        const rejectMatch = pathname.match(/^\/api\/admin\/donations\/([^/]+)\/reject$/);
        if (method === 'POST' && rejectMatch) {
          const donationId = decodeURIComponent(rejectMatch[1]);
          const body = await readJsonBody(req);

          const updated = await db.$transaction(async (tx) => {
            const don = tx.donations.get(donationId);
            if (!don) {
              throw new Error('DONATION_NOT_FOUND: দানের রেকর্ড পাওয়া যায়নি।');
            }
            if (don.status !== 'PENDING') {
              throw new Error(
                `ALREADY_PROCESSED: এই দানটি ইতিমধ্যে ${don.status} অবস্থায় রয়েছে।`
              );
            }

            don.status = 'REJECTED';
            don.verifiedByAdminId = auth.user!.id;
            don.verifiedAt = new Date().toISOString();
            don.verificationNotes =
              typeof body.notes === 'string' ? body.notes.trim() : 'ট্রানজেকশন আইডি সঠিক নয়';

            tx.recordAudit(auth.user!.id, 'DONATION_REJECTED', 'Donation', don.id, {
              transactionId: don.transactionId,
              amountBdt: don.amountBdt,
            });

            return don;
          });

          sendJson(res, 200, {
            success: true,
            data: {
              donation: updated,
              message: 'দানটি বাতিল (REJECTED) হিসেবে চিহ্নিত করা হয়েছে।',
            },
          });
          return;
        }

        // GET & POST /api/admin/expenses
        if (pathname === '/api/admin/expenses') {
          if (method === 'GET') {
            sendJson(res, 200, {
              success: true,
              data: Array.from(db.expenses.values()),
            });
            return;
          }

          if (method === 'POST') {
            const body = await readJsonBody(req);
            const input = validateCreateExpenseInput(body);

            const created = await db.$transaction(async (tx) => {
              const proj = tx.projects.get(input.projectId);
              if (!proj) {
                throw new Error('PROJECT_NOT_FOUND: নির্বাচিত প্রকল্পটি পাওয়া যায়নি।');
              }

              let evidenceObj;
              if (input.evidence) {
                const stored = storage.saveFile({
                  fileName: input.evidence.fileName,
                  mimeType: input.evidence.mimeType,
                  sizeBytes: input.evidence.sizeBytes,
                  isPrivate: !input.evidence.publicDisclosure,
                });
                evidenceObj = {
                  id: `ev_${crypto.randomUUID()}`,
                  ...stored,
                  publicDisclosure: input.evidence.publicDisclosure,
                };
              }

              const exp = {
                id: `exp_${crypto.randomUUID()}`,
                projectId: proj.id,
                projectName: proj.name,
                category: input.category,
                amountBdt: input.amountBdt,
                expenseDate: input.expenseDate,
                purpose: input.purpose,
                recipientRef: input.recipientRef,
                publicDisclosure: input.publicDisclosure,
                status: input.status,
                createdById: auth.user!.id,
                approvedById: input.status === 'APPROVED' ? auth.user!.id : undefined,
                evidence: evidenceObj,
                createdAt: new Date().toISOString(),
              };

              tx.expenses.set(exp.id, exp);
              tx.recordAudit(auth.user!.id, 'EXPENSE_CREATED', 'Expense', exp.id, {
                amountBdt: exp.amountBdt,
                status: exp.status,
                projectId: exp.projectId,
              });
              return exp;
            });

            sendJson(res, 201, { success: true, data: created });
            return;
          }
        }

        // PATCH /api/admin/expenses/:id
        if (method === 'PATCH' && pathname.startsWith('/api/admin/expenses/')) {
          const expId = decodeURIComponent(pathname.replace('/api/admin/expenses/', ''));
          const body = await readJsonBody(req);
          const exp = db.expenses.get(expId);
          if (!exp) {
            sendJson(res, 404, {
              success: false,
              error: { code: 'NOT_FOUND', message: 'খরচের রেকর্ড পাওয়া যায়নি।' },
            });
            return;
          }
          if (body.status && ['PENDING', 'APPROVED', 'REJECTED'].includes(String(body.status))) {
            exp.status = body.status as 'PENDING' | 'APPROVED' | 'REJECTED';
          }
          if (body.publicDisclosure !== undefined) {
            exp.publicDisclosure = Boolean(body.publicDisclosure);
          }
          db.recordAudit(auth.user.id, 'EXPENSE_UPDATED', 'Expense', exp.id, {
            status: exp.status,
          });
          sendJson(res, 200, { success: true, data: exp });
          return;
        }

        // POST /api/admin/projects
        if (method === 'POST' && pathname === '/api/admin/projects') {
          const body = await readJsonBody(req);
          const input = validateUpsertProjectInput(body);
          const dup = Array.from(db.projects.values()).find((p) => p.slug === input.slug);
          if (dup) {
            sendJson(res, 409, {
              success: false,
              error: { code: 'DUPLICATE_SLUG', message: 'এই স্লাগের প্রকল্প ইতিমধ্যে রয়েছে।' },
            });
            return;
          }
          const created = {
            id: `proj_${crypto.randomUUID()}`,
            name: input.name,
            slug: input.slug,
            description: input.description,
            category: input.category,
            imageUrl: input.imageUrl || '/assets/banner.jpg',
            targetAmountBdt: input.targetAmountBdt,
            collectedBdt: 0,
            status: input.status,
            updates: [],
            createdAt: new Date().toISOString(),
          };
          db.projects.set(created.id, created);
          db.recordAudit(auth.user.id, 'PROJECT_CREATED', 'DonationProject', created.id, {
            slug: created.slug,
          });
          sendJson(res, 201, { success: true, data: created });
          return;
        }

        // PATCH & DELETE /api/admin/projects/:id
        if (pathname.startsWith('/api/admin/projects/')) {
          const projId = decodeURIComponent(pathname.replace('/api/admin/projects/', ''));
          const proj = db.projects.get(projId);
          if (!proj) {
            sendJson(res, 404, {
              success: false,
              error: { code: 'NOT_FOUND', message: 'প্রকল্প পাওয়া যায়নি।' },
            });
            return;
          }
          if (method === 'PATCH') {
            const body = await readJsonBody(req);
            if (typeof body.name === 'string' && body.name.trim()) proj.name = body.name.trim();
            if (typeof body.description === 'string' && body.description.trim()) {
              proj.description = body.description.trim();
            }
            if (body.targetAmountBdt !== undefined) {
              proj.targetAmountBdt = Math.max(1000, Number(body.targetAmountBdt));
            }
            if (body.status && ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(String(body.status))) {
              proj.status = body.status as typeof proj.status;
            }
            if (typeof body.newUpdateTitle === 'string' && body.newUpdateTitle.trim()) {
              proj.updates.unshift({
                id: `upd_${crypto.randomUUID()}`,
                title: body.newUpdateTitle.trim(),
                content: String(body.newUpdateContent || ''),
                publishedAt: new Date().toISOString(),
              });
            }
            db.recordAudit(auth.user.id, 'PROJECT_UPDATED', 'DonationProject', proj.id, {
              status: proj.status,
              targetAmountBdt: proj.targetAmountBdt,
            });
            sendJson(res, 200, { success: true, data: proj });
            return;
          }
          if (method === 'DELETE') {
            proj.status = 'ARCHIVED';
            db.recordAudit(auth.user.id, 'PROJECT_ARCHIVED', 'DonationProject', proj.id, {});
            sendJson(res, 200, { success: true, data: proj });
            return;
          }
        }

        // GET /api/admin/help-requests
        if (method === 'GET' && pathname === '/api/admin/help-requests') {
          sendJson(res, 200, {
            success: true,
            data: Array.from(db.helpRequests.values()),
          });
          return;
        }

        // POST /api/admin/help-requests/:id/approve
        const hrApproveMatch = pathname.match(/^\/api\/admin\/help-requests\/([^/]+)\/approve$/);
        if (method === 'POST' && hrApproveMatch) {
          const hrId = decodeURIComponent(hrApproveMatch[1]);
          const body = await readJsonBody(req);
          const hr = db.helpRequests.get(hrId);
          if (!hr) {
            sendJson(res, 404, {
              success: false,
              error: { code: 'NOT_FOUND', message: 'আবেদনটি পাওয়া যায়নি।' },
            });
            return;
          }
          hr.status = 'VERIFIED';
          hr.publicVisibility = true;
          hr.reviewedById = auth.user.id;
          hr.reviewedAt = new Date().toISOString();
          if (typeof body.adminNotes === 'string') hr.adminNotes = body.adminNotes;

          db.recordAudit(auth.user.id, 'HELP_REQUEST_APPROVED', 'HelpRequest', hr.id, {
            title: hr.title,
          });
          sendJson(res, 200, { success: true, data: hr });
          return;
        }

        // POST /api/admin/help-requests/:id/reject
        const hrRejectMatch = pathname.match(/^\/api\/admin\/help-requests\/([^/]+)\/reject$/);
        if (method === 'POST' && hrRejectMatch) {
          const hrId = decodeURIComponent(hrRejectMatch[1]);
          const body = await readJsonBody(req);
          const hr = db.helpRequests.get(hrId);
          if (!hr) {
            sendJson(res, 404, {
              success: false,
              error: { code: 'NOT_FOUND', message: 'আবেদনটি পাওয়া যায়নি।' },
            });
            return;
          }
          hr.status = 'REJECTED';
          hr.publicVisibility = false;
          hr.reviewedById = auth.user.id;
          hr.reviewedAt = new Date().toISOString();
          if (typeof body.adminNotes === 'string') hr.adminNotes = body.adminNotes;

          db.recordAudit(auth.user.id, 'HELP_REQUEST_REJECTED', 'HelpRequest', hr.id, {
            title: hr.title,
          });
          sendJson(res, 200, { success: true, data: hr });
          return;
        }

        // GET & PATCH /api/admin/blood-donors
        if (method === 'GET' && pathname === '/api/admin/blood-donors') {
          sendJson(res, 200, {
            success: true,
            data: Array.from(db.bloodDonors.values()),
          });
          return;
        }

        if (method === 'PATCH' && pathname.startsWith('/api/admin/blood-donors/')) {
          const donorId = decodeURIComponent(pathname.replace('/api/admin/blood-donors/', ''));
          const donor = db.bloodDonors.get(donorId);
          if (!donor) {
            sendJson(res, 404, {
              success: false,
              error: { code: 'NOT_FOUND', message: 'রক্তদাতা পাওয়া যায়নি।' },
            });
            return;
          }
          const body = await readJsonBody(req);
          if (body.isActive !== undefined) donor.isActive = Boolean(body.isActive);
          if (body.isAvailable !== undefined) donor.isAvailable = Boolean(body.isAvailable);
          db.recordAudit(auth.user.id, 'BLOOD_DONOR_MODERATED', 'BloodDonor', donor.id, {
            isActive: donor.isActive,
          });
          sendJson(res, 200, { success: true, data: donor });
          return;
        }

        // GET /api/admin/audit-logs
        if (method === 'GET' && pathname === '/api/admin/audit-logs') {
          sendJson(res, 200, {
            success: true,
            data: db.auditLogs,
          });
          return;
        }
      }

      sendJson(res, 404, {
        success: false,
        error: { code: 'ROUTE_NOT_FOUND', message: `Route ${method} ${pathname} not found.` },
      });
    } catch (err: unknown) {
      if (err instanceof SchemaValidationError) {
        const details: Record<string, string[]> = {};
        for (const issue of err.issues) {
          details[issue.field] = details[issue.field] || [];
          details[issue.field].push(issue.message);
        }
        sendJson(res, 400, {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.issues[0]?.message || 'প্রদত্ত তথ্য সঠিক নয়।',
            details,
          },
        });
        return;
      }

      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      const [codePrefix, ...rest] = msg.split(':');
      const knownCodes: Record<string, number> = {
        RATE_LIMIT_EXCEEDED: 429,
        DUPLICATE_TRANSACTION_ID: 409,
        INVALID_PROJECT: 400,
        DONATION_NOT_FOUND: 404,
        ALREADY_PROCESSED: 409,
        INVALID_FILE_TYPE: 400,
        INVALID_MIME_TYPE: 400,
        FILE_TOO_LARGE: 413,
        PAYLOAD_TOO_LARGE: 413,
      };
      const status = knownCodes[codePrefix.trim()] || 500;
      sendJson(res, status, {
        success: false,
        error: {
          code: knownCodes[codePrefix.trim()] ? codePrefix.trim() : 'SERVER_ERROR',
          message: rest.length > 0 ? rest.join(':').trim() : msg,
        },
      });
    }
  }

  return { config, db, storage, handleRequest };
}
