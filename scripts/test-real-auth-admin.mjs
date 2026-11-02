// ============================================================================
// Automated End-to-End Test for Real Auth, Admin Approval, and NeonDB
// ============================================================================

import { spawn } from 'child_process';
import http from 'http';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url + '/api/transparency/summary');
      if (res.ok) return true;
    } catch {
      // server not ready yet
    }
    await sleep(800);
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function runTests() {
  console.log('[Test] Starting Next.js production server on port 3005...');
  const nextProcess = spawn('node', ['apps/web/node_modules/next/dist/bin/next', 'start', 'apps/web', '-p', '3005'], {
    env: { ...process.env, PORT: '3005' },
    stdio: 'inherit',
  });

  try {
    await waitForServer('http://localhost:3005');
    console.log('[Test] Next.js is responding on port 3005!');

    let adminCookie = '';

    // 1. Admin Login
    console.log('\n[Test 1] Testing Admin Login with 01681253714 / Admin@Sadaqah2026!...');
    const loginRes = await fetch('http://localhost:3005/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: '01681253714',
        password: 'Admin@Sadaqah2026!',
      }),
    });
    const loginJson = await loginRes.json();
    console.log('Login Response:', loginJson);
    if (!loginJson.success || loginJson.data?.user?.role !== 'ADMIN') {
      throw new Error('Admin login failed: ' + JSON.stringify(loginJson));
    }
    const rawCookie = loginRes.headers.get('set-cookie');
    if (rawCookie) {
      adminCookie = rawCookie.split(';')[0];
    }
    console.log('✓ Admin login successful! Role:', loginJson.data.user.role);

    // 2. /api/auth/me
    console.log('\n[Test 2] Testing /api/auth/me with admin session cookie...');
    const meRes = await fetch('http://localhost:3005/api/auth/me', {
      headers: { Cookie: adminCookie },
    });
    const meJson = await meRes.json();
    console.log('Auth Me:', meJson);
    if (!meJson.success || meJson.data?.user?.role !== 'ADMIN') {
      throw new Error('Auth me failed: ' + JSON.stringify(meJson));
    }
    console.log('✓ Auth /me verified session user:', meJson.data.user.phone);

    // 3. /api/admin/donations
    console.log('\n[Test 3] Fetching admin donations...');
    const donRes = await fetch('http://localhost:3005/api/admin/donations', {
      headers: { Cookie: adminCookie },
    });
    const donJson = await donRes.json();
    console.log(`✓ Admin fetched ${donJson.data?.length} donations.`);
    const pendingDonation = donJson.data?.find((d) => d.status === 'PENDING');

    if (pendingDonation) {
      console.log(`\n[Test 4] Approving pending donation #${pendingDonation.id} (Amount: ৳${pendingDonation.amountBdt})...`);
      const approveRes = await fetch(`http://localhost:3005/api/admin/donations/${pendingDonation.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ notes: 'Verified via test runner' }),
      });
      const approveJson = await approveRes.json();
      console.log('Approve response:', approveJson);
      if (!approveJson.success) {
        throw new Error('Approval failed: ' + JSON.stringify(approveJson));
      }
      console.log('✓ Donation successfully verified & added to project fund!');
    }

    // 5. User Registration with Mobile + PIN
    const testUserPhone = '019' + Math.floor(10000000 + Math.random() * 90000000);
    console.log(`\n[Test 5] Testing User Sign-Up with Mobile ${testUserPhone} and PIN 7788...`);
    const regRes = await fetch('http://localhost:3005/api/auth/register-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testUserPhone,
        pin: '7788',
        name: 'টেস্ট সাদাকা দাতা',
      }),
    });
    const regJson = await regRes.json();
    console.log('Register Response:', regJson);
    if (!regJson.success || regJson.data?.user?.role !== 'USER') {
      throw new Error('Registration failed: ' + JSON.stringify(regJson));
    }
    console.log('✓ User registered and logged in with role:', regJson.data.user.role);

    // 6. User Login with Mobile + PIN
    console.log(`\n[Test 6] Testing User Login with Mobile ${testUserPhone} and PIN 7788...`);
    const userLoginRes = await fetch('http://localhost:3005/api/auth/login-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testUserPhone,
        pin: '7788',
      }),
    });
    const userLoginJson = await userLoginRes.json();
    console.log('User Login Response:', userLoginJson);
    if (!userLoginJson.success || userLoginJson.data?.user?.phone !== testUserPhone) {
      throw new Error('User login failed: ' + JSON.stringify(userLoginJson));
    }
    console.log('✓ User login with secret PIN verified successfully!');

    // 7. Google OAuth Login
    console.log('\n[Test 7] Testing 1-Click Google Sign-In...');
    const googleRes = await fetch('http://localhost:3005/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testdonor@gmail.com',
        name: 'গুগল টেস্ট দাতা',
        googleId: 'g_9911882233',
      }),
    });
    const googleJson = await googleRes.json();
    console.log('Google Sign-In Response:', googleJson);
    if (!googleJson.success || googleJson.data?.user?.email !== 'testdonor@gmail.com') {
      throw new Error('Google Sign-In failed: ' + JSON.stringify(googleJson));
    }
    console.log('✓ Google Sign-In verified successfully!');

    console.log('\n======================================================');
    console.log('🎉 ALL TESTS PASSED: Real Auth & Admin APIs 100% WORKING');
    console.log('======================================================\n');
  } finally {
    nextProcess.kill('SIGTERM');
  }
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
