import { randomUUID } from 'node:crypto';
import type { Context, SNSEvent, SNSEventRecord } from 'aws-lambda';
import { saveInboundSmsMessage } from './storage.js';
import type {
  HandlerResponse,
  InboundSmsPayload,
  ProcessRecordResult,
} from './types.js';

function parseInboundPayload(rawMessage: string): InboundSmsPayload {
  try {
    const parsed: unknown = JSON.parse(rawMessage);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('SNS message is not a JSON object');
    }
    return parsed as InboundSmsPayload;
  } catch (error) {
    throw new Error(
      `Failed to parse SNS message as JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveTimestamp(record: SNSEventRecord): string {
  return record.Sns.Timestamp ?? new Date().toISOString();
}

async function processRecord(record: SNSEventRecord): Promise<ProcessRecordResult> {
  const payload = parseInboundPayload(record.Sns.Message);
  const messageId = payload.inboundMessageId?.trim() || randomUUID();

  await saveInboundSmsMessage({
    messageId,
    fromNumber: payload.originationNumber ?? '',
    toNumber: payload.destinationNumber ?? '',
    messageBody: payload.messageBody ?? '',
    receivedAt: resolveTimestamp(record),
    rawPayload: payload,
  });

  const cleaned = {
    messageId,
    originationNumber: payload.originationNumber ?? null,
    destinationNumber: payload.destinationNumber ?? null,
    messageBody: payload.messageBody ?? null,
    inboundMessageId: payload.inboundMessageId ?? null,
    receivedAt: resolveTimestamp(record),
  };

  console.log('Processed inbound SMS:', JSON.stringify(cleaned));

  return { messageId };
}

export async function handler(
  event: SNSEvent,
  _context: Context,
): Promise<HandlerResponse> {
  console.log('Raw SNS event:', JSON.stringify(event));

  const results: ProcessRecordResult[] = [];

  for (const record of event.Records) {
    try {
      results.push(await processRecord(record));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to process SNS record:', {
        messageId: record.Sns.MessageId,
        error: message,
      });
      results.push({ error: message });
    }
  }

  const failed = results.filter((result) => result.error).length;

  return {
    statusCode: failed === 0 ? 200 : 207,
    body: JSON.stringify({
      processed: results.length - failed,
      failed,
      results,
    }),
  };
}
