import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  createSessionToken,
  isAuthEnabled,
  sessionCookieHeader,
  verifyDashboardPassword,
} from '../../src/auth-vercel.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthEnabled()) {
    res.status(200).json({ ok: true });
    return;
  }

  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || !verifyDashboardPassword(password)) {
    res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });
    return;
  }

  res.setHeader('Set-Cookie', sessionCookieHeader(createSessionToken()));
  res.status(200).json({ ok: true });
}
