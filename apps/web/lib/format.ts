const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatBdt(amount: number): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = safe.toLocaleString('en-IN');
  return `৳${toBanglaDigits(formatted)}`;
}

export const CATEGORY_LABELS_BN: Record<string, string> = {
  MEDICAL: 'চিকিৎসা সহায়তা',
  FOOD: 'খাদ্য সহায়তা',
  CLEAN_WATER: 'বিশুদ্ধ পানি',
  ORPHAN_CHILD: 'এতিম ও শিশু সহায়তা',
  EDUCATION: 'শিক্ষা সহায়তা',
  HOUSING: 'ঘর মেরামত',
  EMERGENCY: 'জরুরি সহায়তা',
  RAMADAN_IFTAR: 'ইফতার ও রমজান',
  GENERAL_SADAQAH: 'সাধারণ সাদাকা',
  OTHER: 'অন্যান্য সহায়তা',
};

export const STATUS_LABELS_BN: Record<string, string> = {
  PENDING: 'যাচাই চলছে',
  UNDER_REVIEW: 'পর্যালোচনায় আছে',
  VERIFIED: 'দান সম্পন্ন (যাচাইকৃত)',
  APPROVED: 'অনুমোদিত',
  REJECTED: 'বাতিল',
  COMPLETED: 'সম্পন্ন',
};
