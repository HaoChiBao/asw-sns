import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE_NAME = 'asw_session';
const SESSION_DAYS = Number(process.env.SESSION_MAX_DAYS ?? 30);

export function isAuthEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD?.trim());
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || process.env.DASHBOARD_PASSWORD?.trim() || 'dev-insecure-secret';
}

function sign(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

function getSessionToken(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return getCookie(req, COOKIE_NAME);
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function verifyDashboardPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  if (!expected) return false;

  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyApiToken(token: string | undefined): boolean {
  const expected = process.env.DASHBOARD_API_TOKEN?.trim();
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAuthenticated(req: Request): boolean {
  if (!isAuthEnabled()) return true;

  const apiToken = process.env.DASHBOARD_API_TOKEN?.trim();
  if (apiToken) {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : getCookie(req, 'asw_api_token');
    if (verifyApiToken(bearer)) return true;
  }

  return parseSessionToken(getSessionToken(req));
}

export function sessionCookieHeader(token: string): string {
  const maxAge = SESSION_DAYS * 86400;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled()) {
    next();
    return;
  }

  if (isAuthenticated(req)) {
    next();
    return;
  }

  if (req.path.startsWith('/api/')) {
    res.status(401).json({
      error: 'Sign in required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  res.redirect('/login.html');
}

export function generateApiToken(): string {
  return randomBytes(32).toString('base64url');
}
