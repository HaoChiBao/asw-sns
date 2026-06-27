import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthenticated } from '../src/auth-vercel.js';
import { listPhoneNumbers } from '../src/data.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Sign in required', code: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const phoneNumbers = await listPhoneNumbers();
    res.status(200).json({ phoneNumbers });
  } catch (error) {
    console.error('GET /api/phone-numbers:', error);
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Failed to load phone numbers',
      code: 'READER_API_ERROR',
    });
  }
}
