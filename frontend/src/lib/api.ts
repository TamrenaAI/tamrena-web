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
    email: string;
    name: string | null;
    picture_url: string | null;
    created_at: string;
  };
}

export async function signInWithGoogle(idToken: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed (${res.status})`);
  }
  return res.json();
}

export async function devLogin(): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/dev-login`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Dev login failed (${res.status}) — is ALLOW_DEV_LOGIN=true set on the server?`);
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
