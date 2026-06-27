import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAuthEnabled } from '../src/auth-vercel.js';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    authRequired: isAuthEnabled(),
    readerApiConfigured: Boolean(process.env.READER_API_URL?.trim()),
  });
}
