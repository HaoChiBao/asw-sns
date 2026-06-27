import './load-env.js';
import { existsSync } from 'node:fs';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearSessionCookieHeader,
  createSessionToken,
  isAuthEnabled,
  isAuthenticated,
  requireAuth,
  sessionCookieHeader,
  verifyDashboardPassword,
} from './auth.js';
import { listMessages, listPhoneNumbers } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveStaticDir(): string {
  const candidates = [
    resolve(__dirname, '../static'),
    resolve(process.cwd(), 'static'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return resolve(__dirname, '../static');
}

const staticDir = resolveStaticDir();

export const app = express();

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    authRequired: isAuthEnabled(),
    readerApiConfigured: Boolean(process.env.READER_API_URL?.trim()),
  });
});

app.get('/login.html', (req, res) => {
  if (isAuthenticated(req)) {
    res.redirect('/');
    return;
  }
  res.sendFile(resolve(staticDir, 'login.html'));
});

app.get('/login', (_req, res) => {
  res.redirect('/login.html');
});

app.post('/api/auth/login', (req, res) => {
  if (!isAuthEnabled()) {
    res.json({ ok: true });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || !verifyDashboardPassword(password)) {
    res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });
    return;
  }

  res.setHeader('Set-Cookie', sessionCookieHeader(createSessionToken()));
  res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  if (isAuthEnabled() && !isAuthenticated(req)) {
    res.redirect('/login.html');
    return;
  }
  res.sendFile(resolve(staticDir, 'index.html'));
});

app.use(requireAuth);

app.get('/api/messages', async (_req, res) => {
  try {
    const messages = await listMessages();
    res.json({ messages });
  } catch (error) {
    console.error('GET /api/messages:', error);
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Failed to load messages',
      code: 'READER_API_ERROR',
    });
  }
});

app.get('/api/phone-numbers', async (_req, res) => {
  try {
    const phoneNumbers = await listPhoneNumbers();
    res.json({ phoneNumbers });
  } catch (error) {
    console.error('GET /api/phone-numbers:', error);
    res.status(503).json({
      error: error instanceof Error ? error.message : 'Failed to load phone numbers',
      code: 'READER_API_ERROR',
    });
  }
});

app.use(express.static(staticDir, { index: false }));
