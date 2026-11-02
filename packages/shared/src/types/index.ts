export type RoleName = 'USER' | 'ADMIN' | 'MODERATOR';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type ProjectCategory =
  | 'MEDICAL'
  | 'FOOD'
  | 'CLEAN_WATER'
  | 'ORPHAN_CHILD'
  | 'EDUCATION'
  | 'HOUSING'
  | 'EMERGENCY'
  | 'RAMADAN_IFTAR'
  | 'GENERAL_SADAQAH';

export type PaymentProvider = 'BKASH' | 'NAGAD';
export type DonationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVERSED';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type HelpRequestCategory =
  | 'MEDICAL'
  | 'EDUCATION'
  | 'FOOD'
  | 'CLEAN_WATER'
  | 'HOUSING'
  | 'EMERGENCY'
  | 'OTHER';
export type HelpRequestStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'COMPLETED';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ProjectDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;
  imageUrl: string;
  targetAmountBdt: number;
  collectedBdt: number;
  status: ProjectStatus;
  updates?: Array<{
    id: string;
    title: string;
    content: string;
    publishedAt: string;
  }>;
}

export interface TransparencySummaryDTO {
  totalVerifiedDonationsBdt: number;
  totalApprovedExpensesBdt: number;
  remainingBalanceBdt: number;
  pendingDonationsCount: number;
  verifiedDonationsCount: number;
  approvedExpensesCount: number;
  receivingNumbers: {
    bkash: string;
    nagad: string;
  };
  monthlyReport: Array<{
    month: string;
    donationsBdt: number;
    expensesBdt: number;
  }>;
  projectAllocations: Array<{
    projectId: string;
    projectName: string;
    verifiedDonationsBdt: number;
    approvedExpensesBdt: number;
  }>;
}
