import { app } from './app.js';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  const authNote = process.env.DASHBOARD_PASSWORD ? 'password protected' : 'open';
  const readerNote = process.env.READER_API_URL ? 'reader API' : 'READER_API_URL not set';
  console.log(`Dashboard running at http://localhost:${port} (${authNote}, ${readerNote})`);
});
