import {
  ApiResponse,
  ProjectDTO,
  TransparencySummaryDTO,
} from '../../../packages/shared/src/types/index';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return (await res.json()) as ApiResponse<T>;
}

export async function fetchPublicProjects(category?: string): Promise<ProjectDTO[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await apiRequest<ProjectDTO[]>(`/projects${qs}`, { cache: 'no-store' });
  return res.success ? res.data : [];
}

export async function fetchProjectBySlug(slug: string): Promise<ProjectDTO | null> {
  const res = await apiRequest<ProjectDTO>(`/projects/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  return res.success ? res.data : null;
}

export async function fetchTransparencySummary(): Promise<TransparencySummaryDTO | null> {
  const res = await apiRequest<TransparencySummaryDTO>('/transparency/summary', {
    cache: 'no-store',
  });
  return res.success ? res.data : null;
}
