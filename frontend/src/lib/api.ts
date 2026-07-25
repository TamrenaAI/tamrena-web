const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010';
const TOKEN_KEY = 'tamreena_access_token';

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SessionResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    created_at: string;
  };
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) {
      const messages = body.detail.map((e: { msg?: string }) => e.msg).filter(Boolean);
      if (messages.length > 0) return messages.join(', ');
    }
  } catch {
    // fall through to fallback
  }
  return fallback;
}

export async function signUp(username: string, password: string, confirmPassword: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, confirm_password: confirmPassword }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Sign up failed (${res.status})`));
  }
  return res.json();
}

export async function logIn(username: string, password: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, `Sign in failed (${res.status})`));
  }
  return res.json();
}

export async function getMe(): Promise<SessionResponse['user']> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch current user (${res.status})`);
  }
  return res.json();
}
