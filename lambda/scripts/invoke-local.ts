import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SNSEvent } from 'aws-lambda';
import { handler } from '../src/handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplePath = resolve(__dirname, '../../samples/sns-inbound-sms-event.json');

process.env.AWS_REGION ??= 'us-east-1';
process.env.DYNAMODB_TABLE_NAME ??= 'InboundSmsMessages';

const writeToDynamoDb = process.argv.includes('--write');
if (!writeToDynamoDb) {
  process.env.LOCAL_DRY_RUN = 'true';
  console.log('Dry run (no DynamoDB write). Pass --write to persist to DynamoDB.');
}

async function main(): Promise<void> {
  const event = JSON.parse(readFileSync(samplePath, 'utf8')) as SNSEvent;
  const response = await handler(event, {} as never, () => undefined);
  console.log('Handler response:', JSON.stringify(response, null, 2));
}

main().catch((error: unknown) => {
  console.error('Local invoke failed:', error);
  process.exit(1);
});
