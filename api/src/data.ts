export interface InboundMessage {
  messageId: string;
  fromNumber: string;
  toNumber: string;
  messageBody: string;
  receivedAt: string;
}

export interface PhoneNumberEntry {
  phoneNumber: string;
  label: string;
}

function readerBaseUrl(): string {
  const url = process.env.READER_API_URL?.trim();
  if (!url) {
    throw new Error('READER_API_URL is not configured');
  }
  return url.replace(/\/$/, '');
}

function readerHeaders(): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = process.env.READER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;
  return headers;
}

export async function listMessages(): Promise<InboundMessage[]> {
  const res = await fetch(`${readerBaseUrl()}/messages`, { headers: readerHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load messages (${res.status})`);
  }
  const data = (await res.json()) as { messages: InboundMessage[] };
  return data.messages ?? [];
}

export async function listPhoneNumbers(): Promise<PhoneNumberEntry[]> {
  const res = await fetch(`${readerBaseUrl()}/phone-numbers`, { headers: readerHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load phone numbers (${res.status})`);
  }
  const data = (await res.json()) as { phoneNumbers: PhoneNumberEntry[] };
  return data.phoneNumbers ?? [];
}
