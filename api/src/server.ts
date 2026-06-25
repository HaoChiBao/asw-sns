import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPoolOverview, listInboundMessages, sendSms } from './aws.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '../static')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, region: process.env.AWS_REGION ?? 'us-east-2' });
});

app.get('/api/pool', async (_req, res) => {
  try {
    const pool = await getPoolOverview();
    res.json(pool);
  } catch (error) {
    console.error('GET /api/pool failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load pool' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const messages = await listInboundMessages(limit);
    res.json({ messages });
  } catch (error) {
    console.error('GET /api/messages failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load messages' });
  }
});

app.post('/api/send', async (req, res) => {
  const { to, body, from } = req.body as {
    to?: string;
    body?: string;
    from?: string;
  };

  if (!to?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'Both "to" and "body" are required' });
    return;
  }

  try {
    const result = await sendSms(to.trim(), body.trim(), from?.trim() || undefined);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('POST /api/send failed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to send SMS' });
  }
});

app.listen(port, () => {
  console.log(`Dashboard running at http://localhost:${port}`);
});
