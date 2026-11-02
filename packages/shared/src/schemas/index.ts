import {
  BloodGroup,
  HelpRequestCategory,
  PaymentProvider,
  ProjectCategory,
  ProjectStatus,
} from '../types/index';

export interface ValidationIssue {
  field: string;
  message: string;
}

export class SchemaValidationError extends Error {
  public readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join('; '));
    this.name = 'SchemaValidationError';
    this.issues = issues;
  }
}

/**
 * Normalize and validate a Bangladesh mobile phone number.
 * Accepts: 01XXXXXXXXX, +8801XXXXXXXXX, or 8801XXXXXXXXX (operators 3-9).
 * Returns normalized "+8801XXXXXXXXX" or throws SchemaValidationError.
 */
export function normalizeBdPhone(rawPhone: unknown, fieldName = 'phone'): string {
  if (typeof rawPhone !== 'string') {
    throw new SchemaValidationError([
      { field: fieldName, message: 'সঠিক মোবাইল নম্বর প্রদান করুন।' },
    ]);
  }
  const cleaned = rawPhone.replace(/[\s\-()]/g, '');
  const match = cleaned.match(/^(?:\+?88)?(01[3-9]\d{8})$/);
  if (!match) {
    throw new SchemaValidationError([
      {
        field: fieldName,
        message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।',
      },
    ]);
  }
  return `+88${match[1]}`;
}

export function validateOtpRequestInput(input: unknown): { phone: string } {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const phone = normalizeBdPhone(obj.phone, 'phone');
  return { phone };
}

export function validateOtpVerifyInput(input: unknown): {
  phone: string;
  otp: string;
  name?: string;
} {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const phone = normalizeBdPhone(obj.phone, 'phone');
  const otp = typeof obj.otp === 'string' ? obj.otp.trim() : '';
  if (!/^\d{6}$/.test(otp)) {
    throw new SchemaValidationError([
      { field: 'otp', message: '৬ সংখ্যার সঠিক OTP কোড দিন।' },
    ]);
  }
  const name =
    typeof obj.name === 'string' && obj.name.trim().length > 0
      ? obj.name.trim().slice(0, 80)
      : undefined;
  return { phone, otp, name };
}

export interface CreateDonationInput {
  projectId: string;
  senderPhone: string;
  amountBdt: number;
  transactionId: string;
  provider: PaymentProvider;
  donorName?: string;
  message?: string;
  isAnonymous: boolean;
  isDailySadaqah: boolean;
}

export function validateCreateDonationInput(input: unknown): CreateDonationInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const projectId = typeof obj.projectId === 'string' ? obj.projectId.trim() : '';
  if (!projectId) {
    issues.push({ field: 'projectId', message: 'প্রকল্প নির্বাচন করা আবশ্যক।' });
  }

  let senderPhone = '';
  try {
    senderPhone = normalizeBdPhone(obj.senderPhone, 'senderPhone');
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      issues.push(...err.issues);
    }
  }

  const rawAmount = Number(obj.amountBdt);
  if (!Number.isFinite(rawAmount) || !Number.isInteger(rawAmount) || rawAmount < 1 || rawAmount > 10000000) {
    issues.push({
      field: 'amountBdt',
      message: 'দানের পরিমাণ অবশ্যই পূর্ণসংখ্যা (ন্যূনতম ৳১ থেকে সর্বোচ্চ ৳১,০০,০০,০০০) হতে হবে।',
    });
  }

  const provider = obj.provider as PaymentProvider;
  if (provider !== 'BKASH' && provider !== 'NAGAD') {
    issues.push({
      field: 'provider',
      message: 'পেমেন্ট মাধ্যম হিসেবে BKASH অথবা NAGAD নির্বাচন করুন।',
    });
  }

  const rawTrx = typeof obj.transactionId === 'string' ? obj.transactionId.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{6,24}$/.test(rawTrx)) {
    issues.push({
      field: 'transactionId',
      message: 'সঠিক Transaction ID দিন (৬ থেকে ২৪ অক্ষরের ইংরেজি বর্ণ ও সংখ্যা)।',
    });
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  return {
    projectId,
    senderPhone,
    amountBdt: rawAmount,
    transactionId: rawTrx,
    provider,
    donorName: typeof obj.donorName === 'string' ? obj.donorName.trim().slice(0, 80) : undefined,
    message: typeof obj.message === 'string' ? obj.message.trim().slice(0, 300) : undefined,
    isAnonymous: Boolean(obj.isAnonymous),
    isDailySadaqah: Boolean(obj.isDailySadaqah),
  };
}

export interface DailySadaqahInput {
  projectId: string;
  amountBdt: number;
  enabled: boolean;
  reminderTime: string;
}

export function validateDailySadaqahInput(input: unknown): DailySadaqahInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const projectId = typeof obj.projectId === 'string' ? obj.projectId.trim() : '';
  if (!projectId) {
    issues.push({ field: 'projectId', message: 'প্রকল্প নির্বাচন করুন।' });
  }

  const amountBdt = Number(obj.amountBdt);
  if (!Number.isInteger(amountBdt) || amountBdt < 1 || amountBdt > 100000) {
    issues.push({ field: 'amountBdt', message: 'দৈনিক সাদাকার পরিমাণ কমপক্ষে ৳১ হতে হবে।' });
  }

  const reminderTime = typeof obj.reminderTime === 'string' ? obj.reminderTime.trim() : '09:00';
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminderTime)) {
    issues.push({ field: 'reminderTime', message: 'সঠিক রিমাইন্ডার সময় দিন (HH:MM)।' });
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  return {
    projectId,
    amountBdt,
    enabled: obj.enabled !== undefined ? Boolean(obj.enabled) : true,
    reminderTime,
  };
}

const VALID_BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export interface BloodDonorInput {
  displayName: string;
  bloodGroup: BloodGroup;
  district: string;
  area: string;
  contactPhone: string;
  publicPhoneConsent: boolean;
  lastDonationDate?: string;
  isAvailable: boolean;
  isActive: boolean;
  notes?: string;
}

export function validateBloodDonorInput(input: unknown): BloodDonorInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const displayName = typeof obj.displayName === 'string' ? obj.displayName.trim() : '';
  if (displayName.length < 2 || displayName.length > 80) {
    issues.push({ field: 'displayName', message: 'রক্তদাতার নাম কমপক্ষে ২ অক্ষরের হতে হবে।' });
  }

  const bloodGroup = obj.bloodGroup as BloodGroup;
  if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    issues.push({ field: 'bloodGroup', message: 'সঠিক রক্তের গ্রুপ নির্বাচন করুন।' });
  }

  const district = typeof obj.district === 'string' ? obj.district.trim() : '';
  if (!district) {
    issues.push({ field: 'district', message: 'জেলার নাম প্রদান করুন।' });
  }

  const area = typeof obj.area === 'string' ? obj.area.trim() : '';
  if (!area) {
    issues.push({ field: 'area', message: 'এলাকার নাম প্রদান করুন।' });
  }

  let contactPhone = '';
  try {
    contactPhone = normalizeBdPhone(obj.contactPhone, 'contactPhone');
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      issues.push(...err.issues);
    }
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  return {
    displayName,
    bloodGroup,
    district,
    area,
    contactPhone,
    publicPhoneConsent: Boolean(obj.publicPhoneConsent),
    lastDonationDate:
      typeof obj.lastDonationDate === 'string' && obj.lastDonationDate.trim()
        ? obj.lastDonationDate.trim()
        : undefined,
    isAvailable: obj.isAvailable !== undefined ? Boolean(obj.isAvailable) : true,
    isActive: obj.isActive !== undefined ? Boolean(obj.isActive) : true,
    notes: typeof obj.notes === 'string' ? obj.notes.trim().slice(0, 200) : undefined,
  };
}

const VALID_HELP_CATEGORIES: HelpRequestCategory[] = [
  'MEDICAL',
  'EDUCATION',
  'FOOD',
  'CLEAN_WATER',
  'HOUSING',
  'EMERGENCY',
  'OTHER',
];

export interface CreateHelpRequestInput {
  title: string;
  description: string;
  category: HelpRequestCategory;
  district: string;
  area: string;
  requiredAmountBdt: number;
  applicantName: string;
  applicantPhone: string;
  document?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    base64Content: string;
  };
}

export function validateCreateHelpRequestInput(input: unknown): CreateHelpRequestInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const title = typeof obj.title === 'string' ? obj.title.trim() : '';
  if (title.length < 5 || title.length > 150) {
    issues.push({ field: 'title', message: 'আবেদনের শিরোনাম ৫ থেকে ১৫০ অক্ষরের মধ্যে হতে হবে।' });
  }

  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  if (description.length < 10 || description.length > 2000) {
    issues.push({ field: 'description', message: 'বিস্তারিত বিবরণ কমপক্ষে ১০ অক্ষরের হতে হবে।' });
  }

  const category = (obj.category || 'OTHER') as HelpRequestCategory;
  if (!VALID_HELP_CATEGORIES.includes(category)) {
    issues.push({ field: 'category', message: 'সঠিক ক্যাটাগরি নির্বাচন করুন।' });
  }

  const district = typeof obj.district === 'string' ? obj.district.trim() : '';
  if (!district) {
    issues.push({ field: 'district', message: 'জেলার নাম লিখুন।' });
  }

  const area = typeof obj.area === 'string' ? obj.area.trim() : '';
  if (!area) {
    issues.push({ field: 'area', message: 'এলাকার নাম লিখুন।' });
  }

  const requiredAmountBdt = Number(obj.requiredAmountBdt);
  if (!Number.isInteger(requiredAmountBdt) || requiredAmountBdt < 100 || requiredAmountBdt > 5000000) {
    issues.push({
      field: 'requiredAmountBdt',
      message: 'প্রয়োজনীয় টাকার পরিমাণ ন্যূনতম ৳১০০ (পূর্ণসংখ্যা) হতে হবে।',
    });
  }

  const applicantName = typeof obj.applicantName === 'string' ? obj.applicantName.trim() : '';
  if (applicantName.length < 2) {
    issues.push({ field: 'applicantName', message: 'আবেদনকারীর নাম লিখুন।' });
  }

  let applicantPhone = '';
  try {
    applicantPhone = normalizeBdPhone(obj.applicantPhone, 'applicantPhone');
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      issues.push(...err.issues);
    }
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  let document: CreateHelpRequestInput['document'];
  if (obj.document && typeof obj.document === 'object') {
    const docObj = obj.document as Record<string, unknown>;
    document = {
      fileName: String(docObj.fileName || 'document.pdf'),
      mimeType: String(docObj.mimeType || 'application/pdf'),
      sizeBytes: Number(docObj.sizeBytes || 0),
      base64Content: String(docObj.base64Content || ''),
    };
  }

  return {
    title,
    description,
    category,
    district,
    area,
    requiredAmountBdt,
    applicantName,
    applicantPhone,
    document,
  };
}

export interface CreateExpenseInput {
  projectId: string;
  category: ProjectCategory;
  amountBdt: number;
  expenseDate: string;
  purpose: string;
  recipientRef?: string;
  publicDisclosure: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  evidence?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    publicDisclosure: boolean;
  };
}

const VALID_PROJECT_CATEGORIES: ProjectCategory[] = [
  'MEDICAL',
  'FOOD',
  'CLEAN_WATER',
  'ORPHAN_CHILD',
  'EDUCATION',
  'HOUSING',
  'EMERGENCY',
  'RAMADAN_IFTAR',
  'GENERAL_SADAQAH',
];

export function validateCreateExpenseInput(input: unknown): CreateExpenseInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const projectId = typeof obj.projectId === 'string' ? obj.projectId.trim() : '';
  if (!projectId) {
    issues.push({ field: 'projectId', message: 'প্রকল্প নির্বাচন করা আবশ্যক।' });
  }

  const category = (obj.category || 'GENERAL_SADAQAH') as ProjectCategory;
  if (!VALID_PROJECT_CATEGORIES.includes(category)) {
    issues.push({ field: 'category', message: 'সঠিক খরচের খাত নির্বাচন করুন।' });
  }

  const amountBdt = Number(obj.amountBdt);
  if (!Number.isInteger(amountBdt) || amountBdt < 1 || amountBdt > 50000000) {
    issues.push({ field: 'amountBdt', message: 'খরচের টাকার পরিমাণ পূর্ণসংখ্যায় (ন্যূনতম ৳১) দিন।' });
  }

  const expenseDate = typeof obj.expenseDate === 'string' ? obj.expenseDate.trim() : '';
  if (!expenseDate || Number.isNaN(Date.parse(expenseDate))) {
    issues.push({ field: 'expenseDate', message: 'সঠিক তারিখ প্রদান করুন।' });
  }

  const purpose = typeof obj.purpose === 'string' ? obj.purpose.trim() : '';
  if (purpose.length < 4 || purpose.length > 500) {
    issues.push({ field: 'purpose', message: 'খরচের বিবরণ কমপক্ষে ৪ অক্ষরের হতে হবে।' });
  }

  const status = (obj.status || 'APPROVED') as 'PENDING' | 'APPROVED' | 'REJECTED';
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    issues.push({ field: 'status', message: 'সঠিক খরচের অবস্থা নির্বাচন করুন।' });
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  let evidence: CreateExpenseInput['evidence'];
  if (obj.evidence && typeof obj.evidence === 'object') {
    const ev = obj.evidence as Record<string, unknown>;
    evidence = {
      fileName: String(ev.fileName || 'voucher.pdf'),
      mimeType: String(ev.mimeType || 'application/pdf'),
      sizeBytes: Number(ev.sizeBytes || 1024),
      publicDisclosure: ev.publicDisclosure !== undefined ? Boolean(ev.publicDisclosure) : true,
    };
  }

  return {
    projectId,
    category,
    amountBdt,
    expenseDate,
    purpose,
    recipientRef: typeof obj.recipientRef === 'string' ? obj.recipientRef.trim() : undefined,
    publicDisclosure: obj.publicDisclosure !== undefined ? Boolean(obj.publicDisclosure) : true,
    status,
    evidence,
  };
}

export interface UpsertProjectInput {
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;
  imageUrl?: string;
  targetAmountBdt: number;
  status: ProjectStatus;
}

export function validateUpsertProjectInput(input: unknown): UpsertProjectInput {
  const obj = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length < 2) {
    issues.push({ field: 'name', message: 'প্রকল্পের নাম লিখুন।' });
  }

  const slug = typeof obj.slug === 'string' ? obj.slug.trim().toLowerCase() : '';
  if (!/^[a-z0-9-]+$/.test(slug)) {
    issues.push({ field: 'slug', message: 'সঠিক স্লাগ (ইংরেজি ছোট হাতের অক্ষর ও হাইফেন) দিন।' });
  }

  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  if (description.length < 5) {
    issues.push({ field: 'description', message: 'প্রকল্পের সংক্ষিপ্ত বিবরণ দিন।' });
  }

  const category = (obj.category || 'GENERAL_SADAQAH') as ProjectCategory;
  if (!VALID_PROJECT_CATEGORIES.includes(category)) {
    issues.push({ field: 'category', message: 'সঠিক প্রকল্প ক্যাটাগরি নির্বাচন করুন।' });
  }

  const targetAmountBdt = Number(obj.targetAmountBdt);
  if (!Number.isInteger(targetAmountBdt) || targetAmountBdt < 1000) {
    issues.push({ field: 'targetAmountBdt', message: 'লক্ষ্যমাত্রা কমপক্ষে ৳১,০০০ হতে হবে।' });
  }

  const status = (obj.status || 'ACTIVE') as ProjectStatus;
  if (!['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(status)) {
    issues.push({ field: 'status', message: 'সঠিক প্রকল্প স্ট্যাটাস দিন।' });
  }

  if (issues.length > 0) {
    throw new SchemaValidationError(issues);
  }

  return {
    name,
    slug,
    description,
    category,
    imageUrl: typeof obj.imageUrl === 'string' && obj.imageUrl.trim() ? obj.imageUrl.trim() : '/assets/banner.jpg',
    targetAmountBdt,
    status,
  };
}
