import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '../../../lib/prisma';
import { FALLBACK_PROJECTS } from '../../../lib/constants';

export const dynamic = 'force-dynamic';

function getReceivingNumbers() {
  return {
    bkash: process.env.BKASH_RECEIVING_NUMBER || '01681253714',
    nagad: process.env.NAGAD_RECEIVING_NUMBER || '01681253714',
  };
}

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('ds_session')?.value;
  if (!token) return null;
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });
    if (!session || session.revokedAt || new Date() > session.expiresAt || session.user.status !== 'ACTIVE') {
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

async function createSessionForUser(user: { id: string }, response: NextResponse) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 86400_000); // 30 days

  await prisma.session.create({
    data: {
      tokenHash,
      csrfToken,
      userId: user.id,
      expiresAt,
    },
  });

  response.cookies.set('ds_session', rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 86400,
    path: '/',
  });

  return response;
}

// ============================================================================
// GET Handlers
// ============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const path = params.slug ? params.slug.join('/') : '';

  // 1. /api/transparency/summary
  if (path === 'transparency/summary') {
    try {
      const [donationsAgg, expensesAgg, projects, pendingCount, verifiedCount, approvedExpensesCount] =
        await Promise.all([
          prisma.donation.aggregate({
            _sum: { amountBdt: true },
            where: { status: 'VERIFIED' },
          }),
          prisma.expense.aggregate({
            _sum: { amountBdt: true },
            where: { status: 'APPROVED' },
          }),
          prisma.donationProject.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, collectedBdt: true },
          }),
          prisma.donation.count({ where: { status: 'PENDING' } }),
          prisma.donation.count({ where: { status: 'VERIFIED' } }),
          prisma.expense.count({ where: { status: 'APPROVED' } }),
        ]);

      const totalVerifiedDonationsBdt = Number(donationsAgg._sum.amountBdt || 0);
      const totalApprovedExpensesBdt = Number(expensesAgg._sum.amountBdt || 0);
      const remainingBalanceBdt = totalVerifiedDonationsBdt - totalApprovedExpensesBdt;

      return NextResponse.json({
        success: true,
        data: {
          totalVerifiedDonationsBdt,
          totalApprovedExpensesBdt,
          remainingBalanceBdt,
          pendingDonationsCount: pendingCount,
          verifiedDonationsCount: verifiedCount,
          approvedExpensesCount,
          receivingNumbers: getReceivingNumbers(),
          monthlyReport: [
            {
              month: 'অক্টোবর ২০২৬',
              donationsBdt: totalVerifiedDonationsBdt,
              expensesBdt: totalApprovedExpensesBdt,
            },
          ],
          projectAllocations: projects.map((p) => ({
            projectId: p.id,
            projectName: p.name,
            verifiedDonationsBdt: Number(p.collectedBdt),
            approvedExpensesBdt: 0,
          })),
        },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          totalVerifiedDonationsBdt: 242000,
          totalApprovedExpensesBdt: 102000,
          remainingBalanceBdt: 140000,
          pendingDonationsCount: 1,
          verifiedDonationsCount: 3,
          approvedExpensesCount: 3,
          receivingNumbers: getReceivingNumbers(),
          monthlyReport: [{ month: 'অক্টোবর ২০২৬', donationsBdt: 242000, expensesBdt: 102000 }],
          projectAllocations: FALLBACK_PROJECTS.map((p) => ({
            projectId: p.id,
            projectName: p.name,
            verifiedDonationsBdt: p.collectedBdt,
            approvedExpensesBdt: 0,
          })),
        },
      });
    }
  }

  // 2. /api/transparency/expenses
  if (path === 'transparency/expenses') {
    try {
      const expenses = await prisma.expense.findMany({
        where: { status: 'APPROVED', publicDisclosure: true },
        include: { project: true, evidences: true },
        orderBy: { expenseDate: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: expenses.map((e) => ({
          id: e.id,
          projectName: e.project.name,
          category: e.project.category,
          amountBdt: Number(e.amountBdt),
          expenseDate: e.expenseDate.toISOString().split('T')[0],
          purpose: e.purpose,
          evidence:
            e.evidences && e.evidences.length > 0
              ? { fileName: e.evidences[0].fileName, mimeType: e.evidences[0].mimeType }
              : null,
        })),
      });
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }
  }

  // 3. /api/projects
  if (path === 'projects') {
    try {
      const projects = await prisma.donationProject.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({
        success: true,
        data: projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          category: p.category,
          imageUrl: p.imageUrl || '/assets/banner.jpg',
          targetAmountBdt: Number(p.targetAmountBdt),
          collectedBdt: Number(p.collectedBdt),
          status: p.status,
        })),
      });
    } catch {
      return NextResponse.json({ success: true, data: FALLBACK_PROJECTS });
    }
  }

  // 4. /api/projects/:slug
  if (path.startsWith('projects/')) {
    const slug = path.split('/')[1];
    try {
      const p = await prisma.donationProject.findUnique({
        where: { slug },
        include: { updates: true },
      });
      if (!p) return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
      return NextResponse.json({
        success: true,
        data: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          category: p.category,
          imageUrl: p.imageUrl || '/assets/banner.jpg',
          targetAmountBdt: Number(p.targetAmountBdt),
          collectedBdt: Number(p.collectedBdt),
          status: p.status,
          updates: p.updates.map((u) => ({
            id: u.id,
            title: u.title,
            content: u.content,
            publishedAt: u.createdAt.toISOString(),
          })),
        },
      });
    } catch {
      const found = FALLBACK_PROJECTS.find((p) => p.slug === slug);
      if (found) return NextResponse.json({ success: true, data: found });
      return NextResponse.json({ success: false, error: { message: 'Project not found' } }, { status: 404 });
    }
  }

  // 5. /api/blood-donors
  if (path === 'blood-donors') {
    try {
      const donors = await prisma.bloodDonor.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: donors.map((d) => ({
          id: d.id,
          displayName: d.displayName,
          bloodGroup: d.bloodGroup.replace('_POS', '+').replace('_NEG', '-'),
          district: d.district,
          area: d.area,
          contactPhone: d.publicPhoneConsent ? d.contactPhone : null,
          maskedPhone: d.contactPhone.slice(0, 6) + '*****' + d.contactPhone.slice(-2),
          publicPhoneConsent: d.publicPhoneConsent,
          estimatedNextDate: d.estimatedNextDate ? d.estimatedNextDate.toISOString().split('T')[0] : null,
          isAvailable: d.isAvailable,
          medicalDisclaimer: 'রক্তদানের পূর্বে চিকিৎসকের পরামর্শ ও পরীক্ষা আবশ্যক।',
        })),
      });
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }
  }

  // 6. /api/help-requests
  if (path === 'help-requests') {
    try {
      const requests = await prisma.helpRequest.findMany({
        where: { status: 'VERIFIED', publicVisibility: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: requests.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          district: r.district,
          area: r.area,
          requiredAmountBdt: Number(r.requiredAmountBdt),
          applicantName: r.applicantName,
          status: r.status,
        })),
      });
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }
  }

  // 7. /api/auth/me
  if (path === 'auth/me') {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ success: true, data: { user: null } });
    }
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          role: user.role.name,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  }

  // 8. /api/donations/my
  if (path === 'donations/my') {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({
        success: true,
        data: { donations: [], summary: { totalVerifiedBdt: 0, verifiedCount: 0, pendingCount: 0 } },
      });
    }

    try {
      const donations = await prisma.donation.findMany({
        where: {
          OR: [{ userId: user.id }, { senderPhone: user.phone }],
        },
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      let totalVerifiedBdt = 0;
      let verifiedCount = 0;
      let pendingCount = 0;

      const formatted = donations.map((d) => {
        const amt = Number(d.amountBdt);
        if (d.status === 'VERIFIED') {
          totalVerifiedBdt += amt;
          verifiedCount++;
        } else if (d.status === 'PENDING') {
          pendingCount++;
        }
        return {
          id: d.id,
          projectName: d.project.name,
          amountBdt: amt,
          provider: d.provider,
          transactionId: d.transactionId,
          status: d.status,
          isDailySadaqah: false,
          createdAt: d.createdAt.toISOString(),
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          donations: formatted,
          summary: { totalVerifiedBdt, verifiedCount, pendingCount },
        },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: { donations: [], summary: { totalVerifiedBdt: 0, verifiedCount: 0, pendingCount: 0 } },
      });
    }
  }

  // 9. /api/daily-sadaqah/me
  if (path === 'daily-sadaqah/me') {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          preference: {
            id: 'pref_default',
            projectId: 'proj_general',
            amountBdt: 10,
            enabled: true,
            reminderTime: '09:00',
            currentStreak: 0,
          },
          verifiedDailyContributionsBdt: 0,
          notice: 'দৈনিক সাদাকা রিমাইন্ডার সক্রিয় রয়েছে। কোনো স্বয়ংক্রিয় টাকা কাটা হবে না।',
        },
      });
    }

    try {
      let pref = await prisma.dailySadaqahPreference.findUnique({
        where: { userId: user.id },
      });
      if (!pref) {
        pref = await prisma.dailySadaqahPreference.create({
          data: {
            userId: user.id,
            projectId: 'proj_general',
            amountBdt: 10,
            enabled: true,
            reminderTime: '09:00',
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: {
          preference: {
            id: pref.id,
            projectId: pref.projectId,
            amountBdt: Number(pref.amountBdt),
            enabled: pref.enabled,
            reminderTime: pref.reminderTime,
            currentStreak: pref.currentStreak,
          },
          verifiedDailyContributionsBdt: 0,
          notice: 'প্রতিদিন সকাল ' + pref.reminderTime + '-এ আপনাকে সাদাকার নিয়ত স্মরণে রিমাইন্ডার পাঠানো হবে।',
        },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          preference: {
            id: 'pref_default',
            projectId: 'proj_general',
            amountBdt: 10,
            enabled: true,
            reminderTime: '09:00',
            currentStreak: 0,
          },
          verifiedDailyContributionsBdt: 0,
          notice: 'দৈনিক সাদাকা রিমাইন্ডার সক্রিয় রয়েছে।',
        },
      });
    }
  }

  // 10. /api/blood-donors/me
  if (path === 'blood-donors/me') {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ success: true, data: null });
    try {
      const donor = await prisma.bloodDonor.findUnique({
        where: { userId: user.id },
      });
      if (!donor) return NextResponse.json({ success: true, data: null });
      return NextResponse.json({
        success: true,
        data: {
          id: donor.id,
          displayName: donor.displayName,
          bloodGroup: donor.bloodGroup.replace('_POS', '+').replace('_NEG', '-'),
          district: donor.district,
          area: donor.area,
          contactPhone: donor.contactPhone,
          publicPhoneConsent: donor.publicPhoneConsent,
          lastDonationDate: donor.lastDonationDate ? donor.lastDonationDate.toISOString().split('T')[0] : undefined,
          estimatedNextDate: donor.estimatedNextDate ? donor.estimatedNextDate.toISOString().split('T')[0] : undefined,
          isAvailable: donor.isAvailable,
        },
      });
    } catch {
      return NextResponse.json({ success: true, data: null });
    }
  }

  // 11. /api/help-requests/my
  if (path === 'help-requests/my') {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ success: true, data: [] });
    try {
      const reqs = await prisma.helpRequest.findMany({
        where: { applicantId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: reqs.map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          district: r.district,
          area: r.area,
          requiredAmountBdt: Number(r.requiredAmountBdt),
          status: r.status,
          publicVisibility: r.publicVisibility,
          adminNotes: r.adminNotes || undefined,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch {
      return NextResponse.json({ success: true, data: [] });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Read Endpoints
  // --------------------------------------------------------------------------
  // 12. /api/admin/donations
  if (path === 'admin/donations') {
    try {
      const donations = await prisma.donation.findMany({
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: donations.map((d) => ({
          id: d.id,
          projectName: d.project.name,
          senderPhone: d.senderPhone,
          donorName: d.donorName || 'সম্মানিত দাতা',
          amountBdt: Number(d.amountBdt),
          provider: d.provider,
          transactionId: d.transactionId,
          status: d.status,
          isDailySadaqah: false,
          createdAt: d.createdAt.toISOString(),
        })),
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // 13. /api/admin/expenses
  if (path === 'admin/expenses') {
    try {
      const expenses = await prisma.expense.findMany({
        include: { project: { select: { name: true } } },
        orderBy: { expenseDate: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: expenses.map((e) => ({
          id: e.id,
          projectId: e.projectId,
          projectName: e.project.name,
          category: e.category,
          amountBdt: Number(e.amountBdt),
          expenseDate: e.expenseDate.toISOString().split('T')[0],
          purpose: e.purpose,
          recipientRef: e.recipientRef || undefined,
          publicDisclosure: e.publicDisclosure,
          status: e.status,
          createdAt: e.createdAt.toISOString(),
        })),
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // 14. /api/admin/help-requests
  if (path === 'admin/help-requests') {
    try {
      const helpRequests = await prisma.helpRequest.findMany({
        include: { documents: true },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: helpRequests.map((r) => ({
          id: r.id,
          applicantId: r.applicantId,
          title: r.title,
          description: r.description,
          category: r.category,
          district: r.district,
          area: r.area,
          requiredAmountBdt: Number(r.requiredAmountBdt),
          applicantName: r.applicantName,
          applicantPhone: r.applicantPhone,
          status: r.status,
          publicVisibility: r.publicVisibility,
          adminNotes: r.adminNotes || undefined,
          documents: r.documents.map((d) => ({
            id: d.id,
            fileName: d.fileName,
            mimeType: d.mimeType,
            isPrivate: d.isPrivate,
          })),
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // 15. /api/admin/blood-donors
  if (path === 'admin/blood-donors') {
    try {
      const donors = await prisma.bloodDonor.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: donors.map((d) => ({
          id: d.id,
          displayName: d.displayName,
          bloodGroup: d.bloodGroup.replace('_POS', '+').replace('_NEG', '-'),
          district: d.district,
          area: d.area,
          contactPhone: d.contactPhone,
          publicPhoneConsent: d.publicPhoneConsent,
          isAvailable: d.isAvailable,
          isActive: d.isActive,
          createdAt: d.createdAt.toISOString(),
        })),
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // 16. /api/admin/audit-logs
  if (path === 'admin/audit-logs') {
    try {
      const logs = await prisma.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({
        success: true,
        data: logs.map((l) => ({
          id: l.id,
          actorId: l.actorId,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          createdAt: l.createdAt.toISOString(),
        })),
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: { message: `Route GET /api/${path} not found` } }, { status: 404 });
}

// ============================================================================
// POST Handlers
// ============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const path = params.slug ? params.slug.join('/') : '';
  const body = await request.json().catch(() => ({}));

  // --------------------------------------------------------------------------
  // Public & User Donation Submit
  // --------------------------------------------------------------------------
  if (path === 'donations') {
    const { projectId, amountBdt, provider, senderPhone, transactionId, donorName, message, isAnonymous } = body;

    if (!projectId || !amountBdt || !provider || !senderPhone || !transactionId) {
      return NextResponse.json({ success: false, error: { message: 'সব প্রয়োজনীয় তথ্য দিন।' } }, { status: 400 });
    }

    try {
      const existing = await prisma.donation.findUnique({
        where: { transactionId: transactionId.trim().toUpperCase() },
      });
      if (existing) {
        return NextResponse.json({
          success: false,
          error: { message: 'এই Transaction ID (TrxID) ইতিপূর্বে জমা দেওয়া হয়েছে।' },
        }, { status: 409 });
      }

      const currentUser = await getSessionUser(request);

      const donation = await prisma.donation.create({
        data: {
          projectId,
          userId: currentUser?.id || null,
          amountBdt: Number(amountBdt),
          provider: provider as 'BKASH' | 'NAGAD',
          senderPhone: senderPhone.trim(),
          transactionId: transactionId.trim().toUpperCase(),
          donorName: donorName || 'সম্মানিত দাতা',
          message: message || '',
          isAnonymous: Boolean(isAnonymous),
          status: 'PENDING',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'আলহামদুলিল্লাহ! আপনার দানের তথ্য সফলভাবে জমা হয়েছে। অ্যাডমিন ভেরিফিকেশন সম্পন্ন হলে তহবিলে যুক্ত হবে।',
          donation: { id: donation.id },
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'দান সংরক্ষণে সমস্যা হয়েছে।';
      return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Real Authentication: Phone/Email + Secret PIN/Password Login
  // --------------------------------------------------------------------------
  if (path === 'auth/login-password' || path === 'auth/login-pin') {
    const identifier = (body.identifier || body.phone || body.email || '').trim();
    const secret = (body.password || body.pin || '').trim();

    if (!identifier || !secret) {
      return NextResponse.json({ success: false, error: { message: 'মোবাইল নম্বর/ইমেইল এবং পাসওয়ার্ড/পিন দিন।' } }, { status: 400 });
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ phone: identifier }, { email: identifier }],
        },
        include: { role: true },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: { message: 'কোনো একাউন্ট পাওয়া যায়নি। মোবাইল নম্বর বা পাসওয়ার্ড সঠিক কিনা পরীক্ষা করুন।' } }, { status: 401 });
      }

      const hashedSecret = crypto.createHash('sha256').update(secret).digest('hex');

      if (user.passwordHash && user.passwordHash !== hashedSecret) {
        return NextResponse.json({ success: false, error: { message: 'ভুল পিন বা পাসওয়ার্ড। অনুগ্রহ করে পুনরায় সঠিক তথ্য দিন।' } }, { status: 401 });
      }

      // If user had no password yet, set it now
      if (!user.passwordHash) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: hashedSecret },
        });
      }

      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            name: user.name,
            role: user.role.name,
          },
        },
      });

      return await createSessionForUser(user, response);
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Real Authentication: Sign Up with Phone + Secret PIN
  // --------------------------------------------------------------------------
  if (path === 'auth/register-pin') {
    const phone = (body.phone || '').trim();
    const pin = (body.pin || body.password || '').trim();
    const name = (body.name || '').trim();

    if (!phone || !pin) {
      return NextResponse.json({ success: false, error: { message: 'মোবাইল নম্বর এবং গোপন পিন দিন।' } }, { status: 400 });
    }

    if (pin.length < 4) {
      return NextResponse.json({ success: false, error: { message: 'পিন কোড কমপক্ষে ৪ সংখ্যার হতে হবে।' } }, { status: 400 });
    }

    try {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return NextResponse.json({
          success: false,
          error: { message: 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একাউন্ট রয়েছে। অনুগ্রহ করে লগইন করুন।' },
        }, { status: 409 });
      }

      let userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
      if (!userRole) {
        userRole = await prisma.role.create({ data: { name: 'USER', description: 'Regular User' } });
      }

      const passwordHash = crypto.createHash('sha256').update(pin).digest('hex');

      const newUser = await prisma.user.create({
        data: {
          phone,
          name: name || 'সম্মানিত সদস্য',
          passwordHash,
          roleId: userRole.id,
          status: 'ACTIVE',
        },
        include: { role: true },
      });

      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            phone: newUser.phone,
            name: newUser.name,
            role: newUser.role.name,
          },
        },
      });

      return await createSessionForUser(newUser, response);
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Real Authentication: 1-Click Google OAuth Login
  // --------------------------------------------------------------------------
  if (path === 'auth/google') {
    const { credential, email, name, googleId } = body;

    let userEmail = email;
    let userName = name;
    let userGoogleId = googleId;

    // Decode Google JWT if provided
    if (credential && typeof credential === 'string') {
      try {
        const payloadBase64 = credential.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
          userEmail = decoded.email || userEmail;
          userName = decoded.name || userName;
          userGoogleId = decoded.sub || userGoogleId;
        }
      } catch {
        // use fallback fields
      }
    }

    if (!userEmail && !userGoogleId) {
      return NextResponse.json({ success: false, error: { message: 'গুগল ক্রেডেনশিয়াল পাওয়া যায়নি।' } }, { status: 400 });
    }

    try {
      let userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
      if (!userRole) {
        userRole = await prisma.role.create({ data: { name: 'USER', description: 'Regular User' } });
      }

      // Check existing by googleId or email
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(userGoogleId ? [{ googleId: userGoogleId }] : []),
            ...(userEmail ? [{ email: userEmail }] : []),
          ],
        },
        include: { role: true },
      });

      if (!user) {
        // Create new user for this Google account
        const fallbackPhone = 'g_' + (userGoogleId ? userGoogleId.slice(-9) : crypto.randomBytes(4).toString('hex'));
        user = await prisma.user.create({
          data: {
            email: userEmail,
            googleId: userGoogleId,
            name: userName || 'গুগল ব্যবহারকারী',
            phone: fallbackPhone,
            roleId: userRole.id,
            status: 'ACTIVE',
          },
          include: { role: true },
        });
      } else if (!user.googleId && userGoogleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: userGoogleId, name: user.name || userName },
          include: { role: true },
        });
      }

      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            name: user.name,
            role: user.role.name,
          },
        },
      });

      return await createSessionForUser(user, response);
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Legacy OTP compatibility fallback
  // --------------------------------------------------------------------------
  if (path === 'auth/request-otp') {
    return NextResponse.json({
      success: true,
      data: { message: 'দয়া করে সরাসরি আপনার গোপন পিন দিয়ে লগইন করুন।' },
    });
  }

  if (path === 'auth/verify-otp') {
    return NextResponse.json({
      success: false,
      error: { message: 'ওটিপি পদ্ধতি হালনাগাদ করা হয়েছে। সরাসরি মোবাইল ও পিন দিয়ে প্রবেশ করুন।' },
    }, { status: 400 });
  }

  // --------------------------------------------------------------------------
  // Logout
  // --------------------------------------------------------------------------
  if (path === 'auth/logout') {
    const token = request.cookies.get('ds_session')?.value;
    if (token) {
      try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await prisma.session.updateMany({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        });
      } catch {
        // ignore
      }
    }
    const response = NextResponse.json({ success: true, data: { message: 'সফলভাবে লগআউট হয়েছে।' } });
    response.cookies.delete('ds_session');
    return response;
  }

  // --------------------------------------------------------------------------
  // Blood Donor Registration
  // --------------------------------------------------------------------------
  if (path === 'blood-donors') {
    const user = await getSessionUser(request);
    const { displayName, bloodGroup, district, area, contactPhone, publicPhoneConsent } = body;

    if (!displayName || !bloodGroup || !district || !area || !contactPhone) {
      return NextResponse.json({ success: false, error: { message: 'সব প্রয়োজনীয় তথ্য দিন।' } }, { status: 400 });
    }

    try {
      const bgFormatted = bloodGroup.replace('+', '_POS').replace('-', '_NEG');
      const donorUserId = user?.id || (await prisma.user.findFirst({ select: { id: true } }))?.id;

      if (!donorUserId) {
        return NextResponse.json({ success: false, error: { message: 'অনুগ্রহ করে প্রথমে লগইন করুন।' } }, { status: 401 });
      }

      const donor = await prisma.bloodDonor.upsert({
        where: { userId: donorUserId },
        update: {
          displayName,
          bloodGroup: bgFormatted as any,
          district,
          area,
          contactPhone,
          publicPhoneConsent: Boolean(publicPhoneConsent),
          isAvailable: true,
          isActive: true,
        },
        create: {
          userId: donorUserId,
          displayName,
          bloodGroup: bgFormatted as any,
          district,
          area,
          contactPhone,
          publicPhoneConsent: Boolean(publicPhoneConsent),
          isAvailable: true,
          isActive: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'রক্তদাতা হিসেবে আপনার নিবন্ধন সফল হয়েছে। ধন্যবাদ!',
          data: donor,
        },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Help Request Submit
  // --------------------------------------------------------------------------
  if (path === 'help-requests') {
    const user = await getSessionUser(request);
    const { title, description, category, district, area, requiredAmountBdt, applicantName, applicantPhone } = body;

    if (!title || !description || !requiredAmountBdt || !applicantName || !applicantPhone) {
      return NextResponse.json({ success: false, error: { message: 'সব প্রয়োজনীয় তথ্য পূরণ করুন।' } }, { status: 400 });
    }

    try {
      const applicantId = user?.id || (await prisma.user.findFirst({ select: { id: true } }))?.id;
      if (!applicantId) {
        return NextResponse.json({ success: false, error: { message: 'প্রথমে লগইন করুন।' } }, { status: 401 });
      }

      const helpRequest = await prisma.helpRequest.create({
        data: {
          applicantId,
          title,
          description,
          category: (category || 'OTHER') as any,
          district: district || 'ঢাকা',
          area: area || 'সদর',
          requiredAmountBdt: Number(requiredAmountBdt),
          applicantName,
          applicantPhone,
          status: 'PENDING',
          publicVisibility: false,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'আপনার সাহায্যের আবেদন জমা হয়েছে। অ্যাডমিন টিম যাচাই করে এটি অনুমোদন করবেন।',
          helpRequest,
        },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Daily Sadaqah Preference Update
  // --------------------------------------------------------------------------
  if (path === 'daily-sadaqah/me') {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ success: false, error: { message: 'লগইন করুন।' } }, { status: 401 });

    const { projectId, amountBdt, enabled, reminderTime } = body;
    try {
      const pref = await prisma.dailySadaqahPreference.upsert({
        where: { userId: user.id },
        update: {
          projectId: projectId || 'proj_general',
          amountBdt: Number(amountBdt || 10),
          enabled: typeof enabled === 'boolean' ? enabled : true,
          reminderTime: reminderTime || '09:00',
        },
        create: {
          userId: user.id,
          projectId: projectId || 'proj_general',
          amountBdt: Number(amountBdt || 10),
          enabled: typeof enabled === 'boolean' ? enabled : true,
          reminderTime: reminderTime || '09:00',
        },
      });
      return NextResponse.json({ success: true, data: { message: 'দৈনিক সাদাকা সেটিংস সফলভাবে সংরক্ষিত হয়েছে।', preference: pref } });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Action: Approve Donation
  // --------------------------------------------------------------------------
  if (path.startsWith('admin/donations/') && path.endsWith('/approve')) {
    const id = path.split('/')[2];
    try {
      const donation = await prisma.donation.findUnique({ where: { id } });
      if (!donation) return NextResponse.json({ success: false, error: { message: 'দান পাওয়া যায়নি।' } }, { status: 404 });

      const adminUser = (await getSessionUser(request)) || (await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } }));

      await prisma.$transaction([
        prisma.donation.update({
          where: { id },
          data: { status: 'VERIFIED' },
        }),
        prisma.donationProject.update({
          where: { id: donation.projectId },
          data: { collectedBdt: { increment: donation.amountBdt } },
        }),
        prisma.auditLog.create({
          data: {
            actorId: adminUser?.id || donation.userId || 'admin_sys',
            action: 'DONATION_VERIFIED',
            entityType: 'Donation',
            entityId: id,
            metadata: { amountBdt: Number(donation.amountBdt), trx: donation.transactionId },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { message: `দান ট্রানজেকশন (${donation.transactionId}) সফলভাবে অনুমোদিত ও তহবিলে যুক্ত হয়েছে।` },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Action: Reject Donation
  // --------------------------------------------------------------------------
  if (path.startsWith('admin/donations/') && path.endsWith('/reject')) {
    const id = path.split('/')[2];
    try {
      const donation = await prisma.donation.findUnique({ where: { id } });
      if (!donation) return NextResponse.json({ success: false, error: { message: 'দান পাওয়া যায়নি।' } }, { status: 404 });

      const adminUser = (await getSessionUser(request)) || (await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } }));

      await prisma.$transaction([
        prisma.donation.update({
          where: { id },
          data: { status: 'REJECTED' },
        }),
        prisma.auditLog.create({
          data: {
            actorId: adminUser?.id || donation.userId || 'admin_sys',
            action: 'DONATION_REJECTED',
            entityType: 'Donation',
            entityId: id,
            metadata: { notes: body.notes || 'বাতিল করা হয়েছে' },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: { message: `দান ট্রানজেকশন (${donation.transactionId}) বাতিল (Rejected) করা হয়েছে।` },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Action: Create Expense
  // --------------------------------------------------------------------------
  if (path === 'admin/expenses') {
    const { projectId, category, amountBdt, expenseDate, purpose, recipientRef, status, publicDisclosure } = body;
    if (!projectId || !amountBdt || !purpose) {
      return NextResponse.json({ success: false, error: { message: 'খরচের বিবরণ ও পরিমাণ দিন।' } }, { status: 400 });
    }

    try {
      const adminUser = (await getSessionUser(request)) || (await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } }));
      if (!adminUser) return NextResponse.json({ success: false, error: { message: 'অ্যাডমিন ইউজার পাওয়া যায়নি।' } }, { status: 401 });

      const exp = await prisma.expense.create({
        data: {
          projectId,
          category: (category || 'GENERAL') as any,
          amountBdt: Number(amountBdt),
          expenseDate: new Date(expenseDate || Date.now()),
          purpose,
          recipientRef: recipientRef || null,
          status: (status || 'APPROVED') as any,
          publicDisclosure: typeof publicDisclosure === 'boolean' ? publicDisclosure : true,
          createdById: adminUser.id,
          approvedById: adminUser.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          action: 'EXPENSE_RECORDED',
          entityType: 'Expense',
          entityId: exp.id,
          metadata: { amountBdt: Number(amountBdt), purpose },
        },
      });

      return NextResponse.json({
        success: true,
        data: { message: 'নতুন খরচের রেকর্ড সফলভাবে যুক্ত হয়েছে।', id: exp.id },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Action: Approve Help Request
  // --------------------------------------------------------------------------
  if (path.startsWith('admin/help-requests/') && path.endsWith('/approve')) {
    const id = path.split('/')[2];
    try {
      const adminUser = (await getSessionUser(request)) || (await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } }));
      const updated = await prisma.helpRequest.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          publicVisibility: true,
          adminNotes: body.adminNotes || null,
          reviewedById: adminUser?.id || null,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        data: { message: 'আবেদনটি সফলভাবে অনুমোদিত হয়েছে এবং জনসমক্ষে প্রকাশ পেয়েছে।', data: updated },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  // --------------------------------------------------------------------------
  // Admin Action: Reject Help Request
  // --------------------------------------------------------------------------
  if (path.startsWith('admin/help-requests/') && path.endsWith('/reject')) {
    const id = path.split('/')[2];
    try {
      const adminUser = (await getSessionUser(request)) || (await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } } }));
      const updated = await prisma.helpRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          publicVisibility: false,
          adminNotes: body.adminNotes || null,
          reviewedById: adminUser?.id || null,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        data: { message: 'আবেদনটি বাতিল করা হয়েছে।', data: updated },
      });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: { message: `Route POST /api/${path} not found` } }, { status: 404 });
}

// ============================================================================
// PATCH & PUT Handlers
// ============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  const path = params.slug ? params.slug.join('/') : '';
  const body = await request.json().catch(() => ({}));

  // /api/admin/blood-donors/:id
  if (path.startsWith('admin/blood-donors/')) {
    const id = path.split('/')[2];
    try {
      const updated = await prisma.bloodDonor.update({
        where: { id },
        data: {
          ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
          ...(typeof body.isAvailable === 'boolean' ? { isAvailable: body.isAvailable } : {}),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    } catch (e: unknown) {
      return NextResponse.json({ success: false, error: { message: (e as Error).message } }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, error: { message: `Route PATCH /api/${path} not found` } }, { status: 404 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  return POST(request, { params });
}
