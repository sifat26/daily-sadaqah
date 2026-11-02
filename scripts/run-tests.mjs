// ============================================================================
// Daily Sadaqah — Automated Full-Stack Test Runner
// Compiles TypeScript packages, boots the real HTTP API server on an ephemeral
// port, and executes all required Authentication, Donation, Financial,
// Concurrency, Privacy, Admin Audit, Bootstrap, and Frontend tests.
// ============================================================================

import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import './build-all.mjs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const { createApiServer } = require(path.join(ROOT, 'dist/apps/api/src/app.js'));
const { verifyAdminBootstrapGuard } = require(path.join(ROOT, 'dist/prisma/bootstrap-admin.js'));
const { formatBdt, toBanglaDigits } = require(path.join(ROOT, 'dist/apps/web/lib/format.js'));

async function httpRequest(baseUrl, method, endpoint, body = null, headers = {}) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, body: json, setCookie, headers: res.headers };
}

async function runAllSuites() {
  const results = [];
  function recordTest(category, name, fn) {
    results.push({ category, name, fn });
  }

  // Boot isolated API server instance for testing
  const api = createApiServer(
    {
      nodeEnv: 'test',
      otpProvider: 'console-dev',
      otpExpirySeconds: 300,
      otpMaxAttempts: 3,
      bkashReceivingNumber: '01700000000 (TEST-BKASH)',
      nagadReceivingNumber: '01800000000 (TEST-NAGAD)',
      localPrivateStorageDir: path.join(ROOT, 'storage/test-private'),
      localPublicStorageDir: path.join(ROOT, 'storage/test-public'),
    },
    true
  );

  const server = http.createServer((req, res) => {
    void api.handleRequest(req, res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  let donorAuthHeader = {};
  let otherUserAuthHeader = {};
  let adminAuthHeader = {};

  // ==========================================================================
  // SUITE 1: AUTHENTICATION TESTS
  // ==========================================================================
  recordTest('Authentication', '1.1 Valid BD phone OTP request & verification creates HttpOnly session', async () => {
    const reqOtp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', {
      phone: '01711223344',
    });
    assert.strictEqual(reqOtp.status, 200);
    assert.strictEqual(reqOtp.body.success, true);
    assert.strictEqual(reqOtp.body.data.phone, '+8801711223344');
    assert.ok(reqOtp.body.data.devOtp);

    const verOtp = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone: '01711223344',
      otp: reqOtp.body.data.devOtp,
      name: 'রহিম উদ্দিন',
    });
    assert.strictEqual(verOtp.status, 200);
    assert.ok(verOtp.setCookie.includes('HttpOnly'));
    donorAuthHeader = { Authorization: `Bearer ${verOtp.body.data.sessionToken}` };

    const meRes = await httpRequest(baseUrl, 'GET', '/api/auth/me', null, donorAuthHeader);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.data.user.phone, '+8801711223344');
  });

  recordTest('Authentication', '1.2 Invalid OTP increments attempts and locks after maxAttempts', async () => {
    const reqOtp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', {
      phone: '01811223355',
    });
    assert.strictEqual(reqOtp.status, 200);

    // 3 wrong attempts (maxAttempts = 3 in test config)
    for (let i = 0; i < 3; i++) {
      const wrong = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
        phone: '01811223355',
        otp: '000000',
      });
      assert.strictEqual(wrong.status, 401);
      assert.strictEqual(wrong.body.error.code, 'INVALID_OTP');
    }

    // 4th attempt even with right OTP is blocked with 429 OTP_MAX_ATTEMPTS
    const locked = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone: '01811223355',
      otp: reqOtp.body.data.devOtp,
    });
    assert.strictEqual(locked.status, 429);
    assert.strictEqual(locked.body.error.code, 'OTP_MAX_ATTEMPTS');
  });

  recordTest('Authentication', '1.3 Expired OTP is rejected with 400 OTP_EXPIRED', async () => {
    const phone = '+8801911223366';
    const reqOtp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', { phone });
    assert.strictEqual(reqOtp.status, 200);
    // Force expiration in DB
    const otpRec = api.db.otps.get(phone);
    otpRec.expiresAt = Date.now() - 1000;

    const expiredRes = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone,
      otp: reqOtp.body.data.devOtp,
    });
    assert.strictEqual(expiredRes.status, 400);
    assert.strictEqual(expiredRes.body.error.code, 'OTP_EXPIRED');
  });

  recordTest('Authentication', '1.4 Rate limiting blocks excessive OTP requests per phone', async () => {
    const phone = '01611223377';
    await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', { phone });
    await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', { phone });
    await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', { phone });
    const fourth = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', { phone });
    assert.strictEqual(fourth.status, 429);
    assert.strictEqual(fourth.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  recordTest('Authentication', '1.5 Logout revokes server-side session token immediately', async () => {
    const reqOtp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', {
      phone: '01511223388',
    });
    const verOtp = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone: '01511223388',
      otp: reqOtp.body.data.devOtp,
    });
    const tempAuth = { Authorization: `Bearer ${verOtp.body.data.sessionToken}` };

    const logoutRes = await httpRequest(baseUrl, 'POST', '/api/auth/logout', {}, tempAuth);
    assert.strictEqual(logoutRes.status, 200);

    const afterLogout = await httpRequest(baseUrl, 'GET', '/api/auth/me', null, tempAuth);
    assert.strictEqual(afterLogout.status, 401);
  });

  recordTest('Authentication', '1.6 Production environment strictly forbids console-dev OTP provider & enforces admin bootstrap guard', async () => {
    assert.throws(() => {
      createApiServer({ nodeEnv: 'production', otpProvider: 'console-dev' }, false);
    }, /SECURITY_VIOLATION/);

    assert.throws(() => {
      verifyAdminBootstrapGuard({
        enabled: false,
        configuredToken: 'super-secret-bootstrap-token-12345',
        providedToken: 'super-secret-bootstrap-token-12345',
        adminPhone: '01700000099',
        existingAdminCount: 0,
      });
    }, /ADMIN_BOOTSTRAP_DISABLED/);

    assert.throws(() => {
      verifyAdminBootstrapGuard({
        enabled: true,
        configuredToken: 'super-secret-bootstrap-token-12345',
        providedToken: 'super-secret-bootstrap-token-12345',
        adminPhone: '01700000099',
        existingAdminCount: 1,
      });
    }, /ADMIN_ALREADY_INITIALIZED/);
  });

  // Authenticate Admin (`+8801700000001`) and Second Donor (`+8801800000003`)
  recordTest('Authentication', '1.7 Authenticate seeded Admin and Second User sessions', async () => {
    const adminOtp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', {
      phone: '+8801700000001',
    });
    const adminVer = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone: '+8801700000001',
      otp: adminOtp.body.data.devOtp,
    });
    assert.strictEqual(adminVer.body.data.user.role, 'ADMIN');
    adminAuthHeader = { Authorization: `Bearer ${adminVer.body.data.sessionToken}` };

    const user2Otp = await httpRequest(baseUrl, 'POST', '/api/auth/request-otp', {
      phone: '+8801800000003',
    });
    const user2Ver = await httpRequest(baseUrl, 'POST', '/api/auth/verify-otp', {
      phone: '+8801800000003',
      otp: user2Otp.body.data.devOtp,
    });
    otherUserAuthHeader = { Authorization: `Bearer ${user2Ver.body.data.sessionToken}` };
  });

  // ==========================================================================
  // SUITE 2: DONATION & UNIQUENESS TESTS
  // ==========================================================================
  let pendingDonationId = '';
  let rejectedDonationId = '';

  recordTest('Donations', '2.1 Valid manual donation submission creates PENDING record and does NOT increase public total', async () => {
    const beforeSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    const beforeTotal = beforeSum.body.data.totalVerifiedDonationsBdt;

    const createRes = await httpRequest(
      baseUrl,
      'POST',
      '/api/donations',
      {
        projectId: 'proj_medical',
        senderPhone: '01711223344',
        amountBdt: 1500,
        provider: 'BKASH',
        transactionId: 'TRXUNIQUE1001',
        donorName: 'রহিম উদ্দিন',
        isAnonymous: false,
        isDailySadaqah: false,
      },
      donorAuthHeader
    );
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.data.donation.status, 'PENDING');
    pendingDonationId = createRes.body.data.donation.id;

    const afterSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    assert.strictEqual(afterSum.body.data.totalVerifiedDonationsBdt, beforeTotal);
  });

  recordTest('Donations', '2.2 Duplicate Transaction ID is strictly rejected with 409 DUPLICATE_TRANSACTION_ID', async () => {
    const dupRes = await httpRequest(
      baseUrl,
      'POST',
      '/api/donations',
      {
        projectId: 'proj_medical',
        senderPhone: '01711223344',
        amountBdt: 500,
        provider: 'BKASH',
        transactionId: 'TRXUNIQUE1001',
        isAnonymous: false,
        isDailySadaqah: false,
      },
      donorAuthHeader
    );
    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.error.code, 'DUPLICATE_TRANSACTION_ID');
  });

  recordTest('Donations', '2.3 Invalid amount and invalid project are rejected with 400', async () => {
    const badAmt = await httpRequest(baseUrl, 'POST', '/api/donations', {
      projectId: 'proj_medical',
      senderPhone: '01711223344',
      amountBdt: -50,
      provider: 'BKASH',
      transactionId: 'TRXBADAMT01',
    });
    assert.strictEqual(badAmt.status, 400);

    const badProj = await httpRequest(baseUrl, 'POST', '/api/donations', {
      projectId: 'proj_non_existent',
      senderPhone: '01711223344',
      amountBdt: 200,
      provider: 'NAGAD',
      transactionId: 'TRXBADPROJ01',
    });
    assert.strictEqual(badProj.status, 400);
    assert.strictEqual(badProj.body.error.code, 'INVALID_PROJECT');
  });

  recordTest('Donations', '2.4 Unauthorized approval attempt by normal user is blocked with 403', async () => {
    const unauthApprove = await httpRequest(
      baseUrl,
      'POST',
      `/api/admin/donations/${pendingDonationId}/approve`,
      {},
      donorAuthHeader
    );
    assert.strictEqual(unauthApprove.status, 403);
    assert.strictEqual(unauthApprove.body.error.code, 'FORBIDDEN_ADMIN_ONLY');
  });

  // ==========================================================================
  // SUITE 3: FINANCIAL ACCOUNTING & CONCURRENCY TESTS
  // ==========================================================================
  recordTest('Financial', '3.1 Concurrent admin approvals on same donation execute atomically without double-counting', async () => {
    const beforeSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    const beforeVerified = beforeSum.body.data.totalVerifiedDonationsBdt;

    // Fire two concurrent approval requests simultaneously
    const [resA, resB] = await Promise.all([
      httpRequest(
        baseUrl,
        'POST',
        `/api/admin/donations/${pendingDonationId}/approve`,
        { notes: 'Concurrent A' },
        adminAuthHeader
      ),
      httpRequest(
        baseUrl,
        'POST',
        `/api/admin/donations/${pendingDonationId}/approve`,
        { notes: 'Concurrent B' },
        adminAuthHeader
      ),
    ]);

    const statuses = [resA.status, resB.status].sort();
    assert.deepStrictEqual(statuses, [200, 409]);

    const afterSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    assert.strictEqual(
      afterSum.body.data.totalVerifiedDonationsBdt,
      beforeVerified + 1500,
      'Verified donation must be added exactly once'
    );
  });

  recordTest('Financial', '3.2 Rejected donation is excluded from public totals and audited', async () => {
    const sub = await httpRequest(
      baseUrl,
      'POST',
      '/api/donations',
      {
        projectId: 'proj_food',
        senderPhone: '01711223344',
        amountBdt: 999,
        provider: 'NAGAD',
        transactionId: 'TRXREJECT999',
        isAnonymous: false,
        isDailySadaqah: false,
      },
      donorAuthHeader
    );
    rejectedDonationId = sub.body.data.donation.id;

    const beforeSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    const rejRes = await httpRequest(
      baseUrl,
      'POST',
      `/api/admin/donations/${rejectedDonationId}/reject`,
      { notes: 'Invalid TrxID' },
      adminAuthHeader
    );
    assert.strictEqual(rejRes.status, 200);
    assert.strictEqual(rejRes.body.data.donation.status, 'REJECTED');

    const afterSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    assert.strictEqual(
      afterSum.body.data.totalVerifiedDonationsBdt,
      beforeSum.body.data.totalVerifiedDonationsBdt
    );
  });

  recordTest('Financial', '3.3 Approved expense reduces remaining balance while Pending expense does not', async () => {
    const beforeSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    const initialBalance = beforeSum.body.data.remainingBalanceBdt;

    // Create PENDING expense (should not affect balance)
    const pendingExp = await httpRequest(
      baseUrl,
      'POST',
      '/api/admin/expenses',
      {
        projectId: 'proj_medical',
        category: 'MEDICAL',
        amountBdt: 4000,
        expenseDate: '2026-10-30',
        purpose: 'অপেক্ষমাণ ওষুধের বিল',
        publicDisclosure: true,
        status: 'PENDING',
      },
      adminAuthHeader
    );
    assert.strictEqual(pendingExp.status, 201);

    const midSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    assert.strictEqual(midSum.body.data.remainingBalanceBdt, initialBalance);

    // Create APPROVED expense (must reduce remaining balance by 6000)
    const approvedExp = await httpRequest(
      baseUrl,
      'POST',
      '/api/admin/expenses',
      {
        projectId: 'proj_medical',
        category: 'MEDICAL',
        amountBdt: 6000,
        expenseDate: '2026-10-30',
        purpose: 'রোগীর জরুরি সার্জারি ব্যয়',
        publicDisclosure: true,
        status: 'APPROVED',
      },
      adminAuthHeader
    );
    assert.strictEqual(approvedExp.status, 201);

    const finalSum = await httpRequest(baseUrl, 'GET', '/api/transparency/summary');
    assert.strictEqual(finalSum.body.data.remainingBalanceBdt, initialBalance - 6000);
  });

  // ==========================================================================
  // SUITE 4: PRIVACY & FILE SECURITY TESTS
  // ==========================================================================
  recordTest('Privacy', '4.1 User cannot access another user donation record', async () => {
    const res = await httpRequest(
      baseUrl,
      'GET',
      `/api/donations/${pendingDonationId}`,
      null,
      otherUserAuthHeader
    );
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  recordTest('Privacy', '4.2 Blood donor phone number is hidden without explicit consent', async () => {
    const donorsRes = await httpRequest(baseUrl, 'GET', '/api/blood-donors');
    assert.strictEqual(donorsRes.status, 200);
    const rashed = donorsRes.body.data.find((d) => d.id === 'bd_1');
    const tanvir = donorsRes.body.data.find((d) => d.id === 'bd_2');

    assert.strictEqual(rashed.publicPhoneConsent, false);
    assert.strictEqual(rashed.contactPhone, null, 'Phone must be null when consent is false');
    assert.strictEqual(tanvir.publicPhoneConsent, true);
    assert.ok(tanvir.contactPhone, 'Phone is shown when explicit consent is true');
  });

  recordTest('Privacy', '4.3 Private help request document is blocked for other users and allowed for Admin/Owner', async () => {
    // hr_doc_1 belongs to usr_donor_2 (otherUserAuthHeader). donorAuthHeader must get 403:
    const forbiddenDoc = await httpRequest(
      baseUrl,
      'GET',
      '/api/files/private/hr_doc_1',
      null,
      donorAuthHeader
    );
    assert.strictEqual(forbiddenDoc.status, 403);
    assert.strictEqual(forbiddenDoc.body.error.code, 'FORBIDDEN_PRIVATE_DOCUMENT');

    // Admin gets 200 + signedDownloadToken
    const adminDoc = await httpRequest(
      baseUrl,
      'GET',
      '/api/files/private/hr_doc_1',
      null,
      adminAuthHeader
    );
    assert.strictEqual(adminDoc.status, 200);
    assert.ok(adminDoc.body.data.signedDownloadToken);
  });

  recordTest('Privacy', '4.4 Executable uploads (.exe) are rejected by file storage validation', async () => {
    const badUpload = await httpRequest(
      baseUrl,
      'POST',
      '/api/help-requests',
      {
        title: 'জরুরি চিকিৎসা সহায়তা আবেদন',
        description: 'হাসপাতালের প্রেসক্রিপশনসহ সহায়তার আবেদন করা হলো।',
        category: 'MEDICAL',
        district: 'টাঙ্গাইল',
        area: 'সদর',
        requiredAmountBdt: 5000,
        applicantName: 'রহিম উদ্দিন',
        applicantPhone: '01711223344',
        document: {
          fileName: 'malware.exe',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          base64Content: 'dGVzdA==',
        },
      },
      donorAuthHeader
    );
    assert.strictEqual(badUpload.status, 400);
    assert.strictEqual(badUpload.body.error.code, 'INVALID_FILE_TYPE');
  });

  // ==========================================================================
  // SUITE 5: ADMIN & AUDIT LOG TESTS
  // ==========================================================================
  recordTest('Admin', '5.1 All admin actions (Approve, Reject, Expense) are recorded in AuditLog', async () => {
    const logsRes = await httpRequest(
      baseUrl,
      'GET',
      '/api/admin/audit-logs',
      null,
      adminAuthHeader
    );
    assert.strictEqual(logsRes.status, 200);
    const actions = logsRes.body.data.map((l) => l.action);
    assert.ok(actions.includes('DONATION_APPROVED'));
    assert.ok(actions.includes('DONATION_REJECTED'));
    assert.ok(actions.includes('EXPENSE_CREATED'));
  });

  // ==========================================================================
  // SUITE 6: FRONTEND & BENGALI FORMATTING TESTS
  // ==========================================================================
  recordTest('Frontend', '6.1 Bengali currency formatting & 9 initial projects integrity', async () => {
    assert.strictEqual(toBanglaDigits(2026), '২০২৬');
    assert.strictEqual(formatBdt(1500), '৳১,৫০০');

    const projRes = await httpRequest(baseUrl, 'GET', '/api/projects');
    assert.strictEqual(projRes.status, 200);
    assert.strictEqual(projRes.body.data.length, 9, 'Must return all 9 active projects');

    // Verify all compiled frontend pages exist in dist/apps/web/app
    const requiredPages = [
      'page.js',
      'projects/page.js',
      'projects/[slug]/page.js',
      'donate/page.js',
      'transparency/page.js',
      'blood-donors/page.js',
      'help-requests/page.js',
      'login/page.js',
      'account/page.js',
      'admin/page.js',
    ];
    for (const relPage of requiredPages) {
      const fullPath = path.join(ROOT, 'dist/apps/web/app', relPage);
      assert.ok(fs.existsSync(fullPath), `Compiled frontend page missing: ${relPage}`);
    }
  });

  // Execute all registered tests
  let passed = 0;
  let failed = 0;
  console.log('\n=== Daily Sadaqah Full-Stack Automated Test Suite ===');
  for (const t of results) {
    try {
      await t.fn();
      console.log(`  [PASS] [${t.category}] ${t.name}`);
      passed += 1;
    } catch (err) {
      console.error(`  [FAIL] [${t.category}] ${t.name}:`, err.message);
      failed += 1;
    }
  }

  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(path.join(ROOT, 'storage/test-private'), { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'storage/test-public'), { recursive: true, force: true });

  console.log(`=== Summary: ${passed} passed, ${failed} failed (Total: ${results.length}) ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllSuites().catch((err) => {
  console.error(err);
  process.exit(1);
});
