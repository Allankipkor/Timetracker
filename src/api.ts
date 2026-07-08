import type { User } from './types';

// Detect if running inside a Capacitor native app wrapper
const isNative = typeof window !== 'undefined' && (window as any).Capacitor;

const API_BASE = isNative ? 'https://timecamp-nine.vercel.app/api' : '/api';

export function getUserIdHeader(): Record<string, string> {
  const cached = localStorage.getItem('timecamp_current_user');
  if (cached) {
    try {
      const user: User = JSON.parse(cached);
      return { 'x-user-id': user.id };
    } catch {
      return {};
    }
  }
  return {};
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  // Attach user context headers
  const authHeader = getUserIdHeader();
  if (authHeader['x-user-id']) {
    headers.set('x-user-id', authHeader['x-user-id']);
  }

  // Set default content type
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error (Status ${response.status})`);
  }

  return response.json() as Promise<T>;
}
