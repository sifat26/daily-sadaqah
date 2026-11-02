import {
  ApiResponse,
  ProjectDTO,
  TransparencySummaryDTO,
} from '../../../packages/shared/src/types/index';
import { FALLBACK_PROJECTS } from './constants';
import { prisma } from './prisma';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? '/api' : 'http://localhost:4000/api');

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${API_BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      try {
        const parsed = JSON.parse(errorText) as ApiResponse<T>;
        return parsed;
      } catch {
        return {
          success: false,
          error: {
            code: `HTTP_${res.status}`,
            message: `সার্ভার রেসপন্স ত্রুটি: ${res.status}`,
          },
        };
      }
    }

    return (await res.json()) as ApiResponse<T>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: msg,
      },
    };
  }
}

export async function fetchPublicProjects(category?: string): Promise<ProjectDTO[]> {
  // If running on the server (SSR on Vercel), query NeonDB directly via Prisma
  if (typeof window === 'undefined') {
    try {
      const records = await prisma.donationProject.findMany({
        where: {
          status: 'ACTIVE',
          ...(category ? { category: category as any } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      if (records && records.length > 0) {
        return records.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          category: p.category,
          imageUrl: p.imageUrl || '/assets/banner.jpg',
          targetAmountBdt: Number(p.targetAmountBdt),
          collectedBdt: Number(p.collectedBdt),
          status: p.status,
        }));
      }
    } catch {
      // Fallback to initial projects if DB query fails
    }
    return FALLBACK_PROJECTS as unknown as ProjectDTO[];
  }

  // Client-side fetch
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await apiRequest<ProjectDTO[]>(`/projects${qs}`, { cache: 'no-store' });
  return res.success && res.data ? res.data : (FALLBACK_PROJECTS as unknown as ProjectDTO[]);
}

export async function fetchProjectBySlug(slug: string): Promise<ProjectDTO | null> {
  if (typeof window === 'undefined') {
    try {
      const p = await prisma.donationProject.findUnique({
        where: { slug },
        include: { updates: true },
      });
      if (p) {
        return {
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
        };
      }
    } catch {
      // Fallback
    }
    const found = FALLBACK_PROJECTS.find((p) => p.slug === slug);
    return (found as unknown as ProjectDTO) || null;
  }

  const res = await apiRequest<ProjectDTO>(`/projects/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  return res.success ? res.data : null;
}

export async function fetchTransparencySummary(): Promise<TransparencySummaryDTO | null> {
  const bkash = process.env.BKASH_RECEIVING_NUMBER || '01681253714';
  const nagad = process.env.NAGAD_RECEIVING_NUMBER || '01681253714';

  if (typeof window === 'undefined') {
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

      return {
        totalVerifiedDonationsBdt,
        totalApprovedExpensesBdt,
        remainingBalanceBdt,
        pendingDonationsCount: pendingCount,
        verifiedDonationsCount: verifiedCount,
        approvedExpensesCount,
        receivingNumbers: { bkash, nagad },
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
      };
    } catch {
      // Fallback
    }

    return {
      totalVerifiedDonationsBdt: 242000,
      totalApprovedExpensesBdt: 102000,
      remainingBalanceBdt: 140000,
      pendingDonationsCount: 1,
      verifiedDonationsCount: 3,
      approvedExpensesCount: 3,
      receivingNumbers: { bkash, nagad },
      monthlyReport: [{ month: 'অক্টোবর ২০২৬', donationsBdt: 242000, expensesBdt: 102000 }],
      projectAllocations: FALLBACK_PROJECTS.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        verifiedDonationsBdt: p.collectedBdt,
        approvedExpensesBdt: 0,
      })),
    };
  }

  const res = await apiRequest<TransparencySummaryDTO>('/transparency/summary', {
    cache: 'no-store',
  });
  return res.success ? res.data : null;
}
