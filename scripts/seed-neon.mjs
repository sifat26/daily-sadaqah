// ============================================================================
// Daily Sadaqah — Seed Authentic Bangladeshi Records into Neon PostgreSQL
// ============================================================================

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed Neon] Connecting to Neon PostgreSQL...');

  // 1. Roles
  const roles = await Promise.all([
    prisma.role.upsert({ where: { name: 'ADMIN' }, update: {}, create: { name: 'ADMIN', description: 'Administrator' } }),
    prisma.role.upsert({ where: { name: 'USER' }, update: {}, create: { name: 'USER', description: 'Regular User' } }),
    prisma.role.upsert({ where: { name: 'MODERATOR' }, update: {}, create: { name: 'MODERATOR', description: 'Moderator' } }),
  ]);
  const adminRole = roles[0];
  const userRole = roles[1];

  // 2. Admin User
  const adminPassHash = crypto.createHash('sha256').update('Admin@Sadaqah2026!').digest('hex');
  const adminUser = await prisma.user.upsert({
    where: { phone: '01681253714' },
    update: { roleId: adminRole.id, email: 'admin@dailysadaqah.org', passwordHash: adminPassHash, status: 'ACTIVE' },
    create: {
      phone: '01681253714',
      email: 'admin@dailysadaqah.org',
      name: 'প্রধান অ্যাডমিনিস্ট্রেটর',
      passwordHash: adminPassHash,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  // 3. Regular Donor User
  const donorUser = await prisma.user.upsert({
    where: { phone: '01711223344' },
    update: { roleId: userRole.id, name: 'আব্দুল্লাহ আল মামুন' },
    create: {
      phone: '01711223344',
      name: 'আব্দুল্লাহ আল মামুন',
      roleId: userRole.id,
      status: 'ACTIVE',
    },
  });

  // 4. Initial Verified Donations
  const sampleDonations = [
    {
      id: 'don_neon_1',
      userId: donorUser.id,
      projectId: 'proj_medical',
      amountBdt: 85000,
      provider: 'BKASH',
      senderPhone: '01681253714',
      transactionId: 'BKS782341A',
      donorName: 'আব্দুল্লাহ আল মামুন',
      message: 'আল্লাহ এই সাদাকা কবুল করুন এবং অসহায় রোগীদের সুস্থতা দান করুন। আমীন।',
      status: 'VERIFIED',
    },
    {
      id: 'don_neon_2',
      userId: donorUser.id,
      projectId: 'proj_food',
      amountBdt: 62000,
      provider: 'NAGAD',
      senderPhone: '01681253714',
      transactionId: 'NGD451209B',
      donorName: 'আব্দুল্লাহ আল মামুন',
      message: 'বন্যাদুর্গত এলাকার অসচ্ছল পরিবারের খাদ্য সহায়তায় ক্ষুদ্র দান।',
      status: 'VERIFIED',
    },
    {
      id: 'don_neon_3',
      userId: donorUser.id,
      projectId: 'proj_water',
      amountBdt: 95000,
      provider: 'BKASH',
      senderPhone: '01811223344',
      transactionId: 'BKS991240C',
      donorName: 'মাহমুদুল হাসান',
      message: 'সুবিধাবঞ্চিত এলাকায় সুপেয় খাবার পানির টিউবওয়েল স্থাপনের জন্য।',
      status: 'VERIFIED',
    },
    {
      id: 'don_neon_4',
      userId: donorUser.id,
      projectId: 'proj_general',
      amountBdt: 500,
      provider: 'BKASH',
      senderPhone: '01681253714',
      transactionId: 'BKS550192P',
      donorName: 'আব্দুল্লাহ আল মামুন',
      message: 'প্রতিদিনের নিয়মিত সাদাকা। আল্লাহ বরকত দান করুন।',
      status: 'PENDING',
    },
  ];

  for (const d of sampleDonations) {
    await prisma.donation.upsert({
      where: { transactionId: d.transactionId },
      update: { status: d.status, amountBdt: d.amountBdt },
      create: d,
    });
  }

  // Update collected amounts on projects
  await prisma.donationProject.update({
    where: { id: 'proj_medical' },
    data: { collectedBdt: 85000 },
  });
  await prisma.donationProject.update({
    where: { id: 'proj_food' },
    data: { collectedBdt: 62000 },
  });
  await prisma.donationProject.update({
    where: { id: 'proj_water' },
    data: { collectedBdt: 95000 },
  });

  // 5. Approved Expenses
  const sampleExpenses = [
    {
      id: 'exp_neon_1',
      projectId: 'proj_medical',
      category: 'MEDICAL',
      amountBdt: 25000,
      expenseDate: new Date('2026-10-25'),
      purpose: 'টাঙ্গাইল জেনারেল হাসপাতালে ভর্তি ৩ জন অসচ্ছল রোগীর জরুরি ইনসুলিন, রক্ত ও জীবনরক্ষাকারী ওষুধ সরবরাহ ভাউচার #৮০২',
      publicDisclosure: true,
      status: 'APPROVED',
      createdById: adminUser.id,
      approvedById: adminUser.id,
    },
    {
      id: 'exp_neon_2',
      projectId: 'proj_food',
      category: 'FOOD',
      amountBdt: 32000,
      expenseDate: new Date('2026-10-26'),
      purpose: 'কুড়িগ্রাম ও গাইবান্ধার চরাঞ্চলে বন্যাদুর্গত ৫০টি পরিবারের মাঝে চাল, ডাল, ভোজ্যতেল ও শুকনো ত্রাণ সামগ্রী বিতরণ ভাউচার #৮১৫',
      publicDisclosure: true,
      status: 'APPROVED',
      createdById: adminUser.id,
      approvedById: adminUser.id,
    },
    {
      id: 'exp_neon_3',
      projectId: 'proj_water',
      category: 'CLEAN_WATER',
      amountBdt: 45000,
      expenseDate: new Date('2026-10-28'),
      purpose: 'সুনামগঞ্জের দোয়ারাবাজারের প্রত্যন্ত চরাঞ্চলে সুপেয় খাবার পানির জন্য ১টি গভীর তারা পাম্প টিউবওয়েল স্থাপন সম্পন্ন ভাউচার #৮২৮',
      publicDisclosure: true,
      status: 'APPROVED',
      createdById: adminUser.id,
      approvedById: adminUser.id,
    },
  ];

  for (const e of sampleExpenses) {
    await prisma.expense.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    });
  }

  // 6. Blood Donors with distinct user accounts
  const sampleDonors = [
    {
      id: 'bd_neon_1',
      phone: '01700000002',
      displayName: 'মোঃ রাশেদুল ইসলাম',
      bloodGroup: 'O_POS',
      district: 'টাঙ্গাইল',
      area: 'টাঙ্গাইল সদর',
      contactPhone: '01700000002',
      publicPhoneConsent: false,
      isAvailable: true,
      isActive: true,
    },
    {
      id: 'bd_neon_2',
      phone: '01700000003',
      displayName: 'তানভীর আহমেদ',
      bloodGroup: 'A_POS',
      district: 'ঢাকা',
      area: 'মিরপুর-১০',
      contactPhone: '01681253714',
      publicPhoneConsent: true,
      isAvailable: true,
      isActive: true,
    },
    {
      id: 'bd_neon_3',
      phone: '01811223344',
      displayName: 'সাকিব আল হাসান',
      bloodGroup: 'B_POS',
      district: 'চট্টগ্রাম',
      area: 'আগ্রাবাদ',
      contactPhone: '01811223344',
      publicPhoneConsent: true,
      isAvailable: true,
      isActive: true,
    },
    {
      id: 'bd_neon_4',
      phone: '01722334455',
      displayName: 'নাজমুল হুদা',
      bloodGroup: 'AB_POS',
      district: 'সিলেট',
      area: 'জিন্দাবাজার',
      contactPhone: '01722334455',
      publicPhoneConsent: true,
      isAvailable: true,
      isActive: true,
    },
  ];

  for (const b of sampleDonors) {
    const u = await prisma.user.upsert({
      where: { phone: b.phone },
      update: { name: b.displayName },
      create: { phone: b.phone, name: b.displayName, roleId: userRole.id, status: 'ACTIVE' },
    });
    await prisma.bloodDonor.upsert({
      where: { id: b.id },
      update: { userId: u.id, displayName: b.displayName, contactPhone: b.contactPhone },
      create: {
        id: b.id,
        userId: u.id,
        displayName: b.displayName,
        bloodGroup: b.bloodGroup,
        district: b.district,
        area: b.area,
        contactPhone: b.contactPhone,
        publicPhoneConsent: b.publicPhoneConsent,
        isAvailable: b.isAvailable,
        isActive: b.isActive,
      },
    });
  }

  // 7. Community Help Requests
  const sampleHelp = [
    {
      id: 'hr_neon_1',
      applicantId: donorUser.id,
      title: 'হৃদরোগে আক্রান্ত শ্রমজীবী পিতার জরুরি হার্ট সার্জারি সহায়তা',
      category: 'MEDICAL',
      district: 'টাঙ্গাইল',
      area: 'সদর',
      requiredAmountBdt: 80000,
      applicantName: 'মাহমুদুল হাসান',
      applicantPhone: '01681253714',
      description: 'আমার দিনমজুর পিতা জাতীয় হৃদরোগ ইনস্টিটিউটে চিকিৎসাধীন। ডাক্তার জরুরি ভিত্তিতে হার্টের রিং পরানোর পরামর্শ দিয়েছেন। দরিদ্র পরিবারের পক্ষে পুরো খরচ বহন করা অসম্ভব হয়ে পড়েছে।',
      status: 'VERIFIED',
      publicVisibility: true,
    },
  ];

  for (const h of sampleHelp) {
    await prisma.helpRequest.upsert({
      where: { id: h.id },
      update: {},
      create: h,
    });
  }

  console.log('[Seed Neon] All verified donations, expenses, blood donors, and help requests populated successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
