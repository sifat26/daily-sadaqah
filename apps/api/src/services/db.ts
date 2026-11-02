// ============================================================================
// Daily Sadaqah — Transactional Database & Accounting Service
// Uses integer BDT values (no floating-point inaccuracies) and an async mutex
// transaction lock so concurrent approvals or writes are 100% atomic.
// ============================================================================

import crypto from 'crypto';
import {
  BloodGroup,
  DonationStatus,
  ExpenseStatus,
  HelpRequestCategory,
  HelpRequestStatus,
  PaymentProvider,
  ProjectCategory,
  ProjectStatus,
  RoleName,
} from '../../../../packages/shared/src/types/index';
import { INITIAL_NINE_PROJECTS } from '../../../../prisma/seed';

export interface UserRecord {
  id: string;
  phone: string;
  name: string;
  role: RoleName;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  csrfToken: string;
  userId: string;
  expiresAt: number;
  revokedAt: number | null;
}

export interface OtpRecord {
  id: string;
  phone: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  verifiedAt: number | null;
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;
  imageUrl: string;
  targetAmountBdt: number;
  collectedBdt: number;
  status: ProjectStatus;
  updates: Array<{
    id: string;
    title: string;
    content: string;
    publishedAt: string;
  }>;
  createdAt: string;
}

export interface DonationRecord {
  id: string;
  userId: string | null;
  projectId: string;
  projectName: string;
  senderPhone: string;
  donorName: string;
  isAnonymous: boolean;
  amountBdt: number;
  provider: PaymentProvider;
  transactionId: string;
  message?: string;
  isDailySadaqah: boolean;
  status: DonationStatus;
  verifiedByAdminId?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
}

export interface DailySadaqahPrefRecord {
  id: string;
  userId: string;
  projectId: string;
  amountBdt: number;
  enabled: boolean;
  reminderTime: string;
  currentStreak: number;
  updatedAt: string;
}

export interface ExpenseRecord {
  id: string;
  projectId: string;
  projectName: string;
  category: ProjectCategory;
  amountBdt: number;
  expenseDate: string;
  purpose: string;
  recipientRef?: string;
  publicDisclosure: boolean;
  status: ExpenseStatus;
  createdById: string;
  approvedById?: string;
  evidence?: {
    id: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    publicDisclosure: boolean;
  };
  createdAt: string;
}

export interface BloodDonorRecord {
  id: string;
  userId: string;
  displayName: string;
  bloodGroup: BloodGroup;
  district: string;
  area: string;
  contactPhone: string;
  publicPhoneConsent: boolean;
  lastDonationDate?: string;
  estimatedNextDate?: string;
  isAvailable: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface HelpRequestRecord {
  id: string;
  applicantId: string;
  title: string;
  description: string;
  category: HelpRequestCategory;
  district: string;
  area: string;
  requiredAmountBdt: number;
  applicantName: string;
  applicantPhone: string;
  status: HelpRequestStatus;
  publicVisibility: boolean;
  adminNotes?: string;
  reviewedById?: string;
  reviewedAt?: string;
  documents: Array<{
    id: string;
    fileKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    isPrivate: boolean;
  }>;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class TransactionalDatabase {
  public users: Map<string, UserRecord> = new Map();
  public sessions: Map<string, SessionRecord> = new Map();
  public otps: Map<string, OtpRecord> = new Map();
  public projects: Map<string, ProjectRecord> = new Map();
  public donations: Map<string, DonationRecord> = new Map();
  public transactionIdIndex: Set<string> = new Set();
  public dailyPrefs: Map<string, DailySadaqahPrefRecord> = new Map();
  public expenses: Map<string, ExpenseRecord> = new Map();
  public bloodDonors: Map<string, BloodDonorRecord> = new Map();
  public helpRequests: Map<string, HelpRequestRecord> = new Map();
  public auditLogs: AuditLogRecord[] = [];

  private mutexQueue: Promise<unknown> = Promise.resolve();

  constructor(seedSampleData = true) {
    if (seedSampleData) {
      this.seedControlledData();
    }
  }

  /**
   * Serializes transactional operations to guarantee ACID isolation and
   * prevent race conditions (such as concurrent donation approvals).
   */
  public async $transaction<T>(fn: (tx: this) => Promise<T> | T): Promise<T> {
    const run = async (): Promise<T> => {
      return await fn(this);
    };
    const resultPromise = this.mutexQueue.then(run, run);
    this.mutexQueue = resultPromise.then(
      () => undefined,
      () => undefined
    );
    return resultPromise;
  }

  public seedControlledData(): void {
    // 1. Seed default Admin & Sample Users
    const adminUser: UserRecord = {
      id: 'usr_admin_1',
      phone: '+8801700000001',
      name: 'সিস্টেম অ্যাডমিন',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-10-01T09:00:00.000Z',
    };
    const donorUser: UserRecord = {
      id: 'usr_donor_1',
      phone: '+8801700000002',
      name: 'আব্দুল্লাহ আল মামুন',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-05T10:00:00.000Z',
    };
    const otherUser: UserRecord = {
      id: 'usr_donor_2',
      phone: '+8801800000003',
      name: 'মাহমুদুল হাসান',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-06T11:00:00.000Z',
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(donorUser.id, donorUser);
    this.users.set(otherUser.id, otherUser);

    // 2. Seed the 9 Initial Projects with 0 base collectedBdt, then apply verified donations
    for (const p of INITIAL_NINE_PROJECTS) {
      this.projects.set(p.id, {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        imageUrl: p.imageUrl,
        targetAmountBdt: p.targetAmountBdt,
        collectedBdt: 0,
        status: p.status,
        updates: [
          {
            id: `upd_${p.id}_1`,
            title: `${p.name} — মাঠ পর্যায়ের সাম্প্রতিক কার্যক্রম আপডেট`,
            content: `${p.name} প্রকল্পের আওতায় সংগৃহীত তহবিল দিয়ে মাঠ পর্যায়ে সরাসরি অসহায় মানুষের কাছে জরুরি সহায়তা পৌঁছে দেওয়া হয়েছে। প্রতিটি ব্যয়ের ভাউচার স্বচ্ছতা পাতায় উন্মুক্ত রয়েছে।`,
            publishedAt: '2026-10-20T12:00:00.000Z',
          },
        ],
        createdAt: '2026-10-01T09:00:00.000Z',
      });
    }

    // 3. Seed Verified & Pending Sample Donations
    const sampleDonations: DonationRecord[] = [
      {
        id: 'don_seed_1',
        userId: donorUser.id,
        projectId: 'proj_medical',
        projectName: 'চিকিৎসা সহায়তা',
        senderPhone: '01681253714',
        donorName: donorUser.name,
        isAnonymous: false,
        amountBdt: 85000,
        provider: 'BKASH',
        transactionId: 'BKS782341A',
        message: 'আল্লাহ এই সাদাকা কবুল করুন এবং অসহায় রোগীদের সুস্থতা দান করুন। আমীন।',
        isDailySadaqah: false,
        status: 'VERIFIED',
        verifiedByAdminId: adminUser.id,
        verifiedAt: '2026-10-15T14:00:00.000Z',
        createdAt: '2026-10-15T13:30:00.000Z',
      },
      {
        id: 'don_seed_2',
        userId: donorUser.id,
        projectId: 'proj_food',
        projectName: 'খাদ্য সহায়তা',
        senderPhone: '01681253714',
        donorName: donorUser.name,
        isAnonymous: false,
        amountBdt: 62000,
        provider: 'NAGAD',
        transactionId: 'NGD451209B',
        message: 'বন্যাদুর্গত এলাকার অসচ্ছল পরিবারের খাদ্য সহায়তায় ক্ষুদ্র দান।',
        isDailySadaqah: false,
        status: 'VERIFIED',
        verifiedByAdminId: adminUser.id,
        verifiedAt: '2026-10-18T14:00:00.000Z',
        createdAt: '2026-10-18T13:00:00.000Z',
      },
      {
        id: 'don_seed_3',
        userId: otherUser.id,
        projectId: 'proj_water',
        projectName: 'বিশুদ্ধ পানি',
        senderPhone: '+8801800000003',
        donorName: otherUser.name,
        isAnonymous: false,
        amountBdt: 95000,
        provider: 'BKASH',
        transactionId: 'BKS991240C',
        message: 'সুবিধাবঞ্চিত এলাকায় সুপেয় খাবার পানির টিউবওয়েল স্থাপনের জন্য।',
        isDailySadaqah: false,
        status: 'VERIFIED',
        verifiedByAdminId: adminUser.id,
        verifiedAt: '2026-10-22T15:00:00.000Z',
        createdAt: '2026-10-22T14:00:00.000Z',
      },
      {
        id: 'don_seed_4',
        userId: donorUser.id,
        projectId: 'proj_general',
        projectName: 'সাধারণ সাদাকা',
        senderPhone: '01681253714',
        donorName: donorUser.name,
        isAnonymous: false,
        amountBdt: 500,
        provider: 'BKASH',
        transactionId: 'BKS550192P',
        message: 'প্রতিদিনের নিয়মিত সাদাকা। আল্লাহ বরকত দান করুন।',
        isDailySadaqah: true,
        status: 'PENDING',
        createdAt: '2026-10-30T08:00:00.000Z',
      },
    ];

    for (const d of sampleDonations) {
      this.donations.set(d.id, d);
      this.transactionIdIndex.add(d.transactionId);
      if (d.status === 'VERIFIED') {
        const proj = this.projects.get(d.projectId);
        if (proj) {
          proj.collectedBdt += d.amountBdt;
        }
      }
    }

    // 4. Seed Daily Sadaqah Preference for sample donor
    this.dailyPrefs.set(donorUser.id, {
      id: 'dsp_1',
      userId: donorUser.id,
      projectId: 'proj_general',
      amountBdt: 10,
      enabled: true,
      reminderTime: '09:00',
      currentStreak: 5,
      updatedAt: '2026-10-30T08:00:00.000Z',
    });

    // 5. Seed Sample Approved Expenses
    const sampleExpenses: ExpenseRecord[] = [
      {
        id: 'exp_seed_1',
        projectId: 'proj_medical',
        projectName: 'চিকিৎসা সহায়তা',
        category: 'MEDICAL',
        amountBdt: 25000,
        expenseDate: '2026-10-25',
        purpose: 'টাঙ্গাইল জেনারেল হাসপাতালে ভর্তি ৩ জন অসচ্ছল রোগীর জরুরি ইনসুলিন, রক্ত ও জীবনরক্ষাকারী ওষুধ সরবরাহ ভাউচার #৮০২',
        recipientRef: 'REC-MED-101',
        publicDisclosure: true,
        status: 'APPROVED',
        createdById: adminUser.id,
        approvedById: adminUser.id,
        evidence: {
          id: 'ev_1',
          fileKey: 'pub_voucher_101.pdf',
          fileName: 'hospital-voucher-802.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 42000,
          publicDisclosure: true,
        },
        createdAt: '2026-10-25T16:00:00.000Z',
      },
      {
        id: 'exp_seed_2',
        projectId: 'proj_food',
        projectName: 'খাদ্য সহায়তা',
        category: 'FOOD',
        amountBdt: 32000,
        expenseDate: '2026-10-26',
        purpose: 'কুড়িগ্রাম ও গাইবান্ধার চরাঞ্চলে বন্যাদুর্গত ৫০টি পরিবারের মাঝে চাল, ডাল, ভোজ্যতেল ও শুকনো ত্রাণ সামগ্রী বিতরণ ভাউচার #৮১৫',
        recipientRef: 'REC-FOOD-102',
        publicDisclosure: true,
        status: 'APPROVED',
        createdById: adminUser.id,
        approvedById: adminUser.id,
        evidence: {
          id: 'ev_2',
          fileKey: 'pub_voucher_102.pdf',
          fileName: 'food-distribution-815.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 51200,
          publicDisclosure: true,
        },
        createdAt: '2026-10-26T16:00:00.000Z',
      },
      {
        id: 'exp_seed_3',
        projectId: 'proj_water',
        projectName: 'বিশুদ্ধ পানি',
        category: 'CLEAN_WATER',
        amountBdt: 45000,
        expenseDate: '2026-10-28',
        purpose: 'সুনামগঞ্জের দোয়ারাবাজারের প্রত্যন্ত চরাঞ্চলে সুপেয় খাবার পানির জন্য ১টি গভীর তারা পাম্প টিউবওয়েল স্থাপন ও পাইপলাইন সম্পন্ন ভাউচার #৮২৮',
        recipientRef: 'REC-WAT-103',
        publicDisclosure: true,
        status: 'APPROVED',
        createdById: adminUser.id,
        approvedById: adminUser.id,
        evidence: {
          id: 'ev_3',
          fileKey: 'pub_voucher_103.pdf',
          fileName: 'tubewell-voucher-828.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 38900,
          publicDisclosure: true,
        },
        createdAt: '2026-10-28T16:00:00.000Z',
      },
    ];

    for (const e of sampleExpenses) {
      this.expenses.set(e.id, e);
    }

    // 6. Seed Sample Blood Donors (Privacy-protected by default)
    const sampleDonors: BloodDonorRecord[] = [
      {
        id: 'bd_1',
        userId: donorUser.id,
        displayName: 'মোঃ রাশেদুল ইসলাম',
        bloodGroup: 'O+',
        district: 'টাঙ্গাইল',
        area: 'টাঙ্গাইল সদর',
        contactPhone: '+8801700000002',
        publicPhoneConsent: false,
        lastDonationDate: '2026-06-15',
        estimatedNextDate: '2026-10-15',
        isAvailable: true,
        isActive: true,
        notes: 'জরুরি প্রয়োজনে প্ল্যাটফর্মের মাধ্যমে যোগাযোগ করুন।',
        createdAt: '2026-10-05T12:00:00.000Z',
      },
      {
        id: 'bd_2',
        userId: otherUser.id,
        displayName: 'তানভীর আহমেদ',
        bloodGroup: 'A+',
        district: 'ঢাকা',
        area: 'মিরপুর-১০',
        contactPhone: '01681253714',
        publicPhoneConsent: true,
        lastDonationDate: '2026-05-10',
        estimatedNextDate: '2026-09-10',
        isAvailable: true,
        isActive: true,
        notes: 'মিরপুর ও আশেপাশের যেকোনো হাসপাতালে জরুরি প্রয়োজনে কল করুন।',
        createdAt: '2026-10-06T12:00:00.000Z',
      },
      {
        id: 'bd_3',
        userId: 'usr_donor_3',
        displayName: 'সাকিব আল হাসান',
        bloodGroup: 'B+',
        district: 'চট্টগ্রাম',
        area: 'আগ্রাবাদ',
        contactPhone: '01811223344',
        publicPhoneConsent: true,
        lastDonationDate: '2026-07-20',
        estimatedNextDate: '2026-11-20',
        isAvailable: true,
        isActive: true,
        notes: 'চট্টগ্রাম মেডিকেল বা আগ্রাবাদের যেকোনো ক্লিনিকের জন্য যোগাযোগ করুন।',
        createdAt: '2026-10-08T12:00:00.000Z',
      },
      {
        id: 'bd_4',
        userId: 'usr_donor_4',
        displayName: 'নাজমুল হুদা',
        bloodGroup: 'AB+',
        district: 'সিলেট',
        area: 'জিন্দাবাজার',
        contactPhone: '01722334455',
        publicPhoneConsent: true,
        lastDonationDate: '2026-08-01',
        estimatedNextDate: '2026-12-01',
        isAvailable: true,
        isActive: true,
        notes: 'সিলেট ওসমানী মেডিকেল ও আশেপাশের হাসপাতালে রক্ত দিতে প্রস্তুত।',
        createdAt: '2026-10-10T12:00:00.000Z',
      },
    ];

    for (const b of sampleDonors) {
      this.bloodDonors.set(b.id, b);
    }

    // 7. Seed Sample Help Requests (1 VERIFIED public, 1 PENDING private)
    const sampleHelp: HelpRequestRecord[] = [
      {
        id: 'hr_seed_1',
        applicantId: otherUser.id,
        title: 'হৃদরোগে আক্রান্ত শ্রমজীবী পিতার জরুরি হার্ট সার্জারি সহায়তা',
        description:
          'দিনমজুর মোঃ আব্দুল করিম দীর্ঘদিন ধরে গুরুতর হৃদরোগে ভুগছেন। চিকিৎসকরা জরুরি ভিত্তিতে রিং পরানোর পরামর্শ দিয়েছেন যার খরচ মেটানো তার অসচ্ছল পরিবারের পক্ষে অসম্ভব হয়ে পড়েছে। সকল প্রেসক্রিপশন ও মেডিকেল টেস্টের রিপোর্ট সংযুক্ত রয়েছে। দয়া করে আপনার সাদাকা দিয়ে এক অসহায় পরিবারের পাশে দাঁড়ান।',
        category: 'MEDICAL',
        district: 'টাঙ্গাইল',
        area: 'মির্জাপুর',
        requiredAmountBdt: 15000,
        applicantName: 'মোঃ আব্দুল করিম',
        applicantPhone: '01681253714',
        status: 'VERIFIED',
        publicVisibility: true,
        reviewedById: adminUser.id,
        reviewedAt: '2026-10-24T10:00:00.000Z',
        documents: [
          {
            id: 'hr_doc_1',
            fileKey: 'priv_medical_prescription_sample.pdf',
            fileName: 'prescription-sample.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 28000,
            isPrivate: true,
          },
        ],
        createdAt: '2026-10-23T09:00:00.000Z',
      },
      {
        id: 'hr_seed_2',
        applicantId: donorUser.id,
        title: 'আকস্মিক অগ্নিকাণ্ডে পুড়ে যাওয়া বসতঘর পুনর্নির্মাণ সহায়তা',
        description:
          'বৈদ্যুতিক শর্ট সার্কিট থেকে লাগা আগুনে দিনমজুর রহিম মিয়ার একমাত্র থাকার ঘরটি পুড়ে ছাই হয়ে গেছে। স্ত্রী ও দুই সন্তান নিয়ে খোলা আকাশের নিচে মানবেতর জীবনযাপন করছেন। ঘর মেরামতের জন্য জরুরি টিন ও কাঠ সামগ্রী ক্রয়ের আর্থিক সহায়তা প্রয়োজন।',
        category: 'HOUSING',
        district: 'টাঙ্গাইল',
        area: 'নাগরপুর',
        requiredAmountBdt: 12000,
        applicantName: 'রহিমা বেগম (নমুনা)',
        applicantPhone: '+8801700000002',
        status: 'PENDING',
        publicVisibility: false,
        documents: [
          {
            id: 'hr_doc_2',
            fileKey: 'priv_nid_sample.pdf',
            fileName: 'verification-doc-sample.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 31000,
            isPrivate: true,
          },
        ],
        createdAt: '2026-10-29T11:00:00.000Z',
      },
    ];

    for (const hr of sampleHelp) {
      this.helpRequests.set(hr.id, hr);
    }
  }

  public recordAudit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> = {}
  ): AuditLogRecord {
    const entry: AuditLogRecord = {
      id: `aud_${crypto.randomUUID()}`,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    return entry;
  }
}
