import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

const region = process.env.AWS_REGION ?? 'us-east-2';
const tableName = process.env.DYNAMODB_TABLE_NAME ?? 'InboundSmsMessages';
const apiKey = process.env.READER_API_KEY;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

function corsHeaders() {
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-api-key',
    'access-control-allow-methods': 'GET,OPTIONS',
  };
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

function authorize(event: { headers?: Record<string, string | undefined> }): boolean {
  if (!apiKey) return true;
  const provided =
    event.headers?.['x-api-key'] ??
    event.headers?.['X-Api-Key'] ??
    event.headers?.['X-API-Key'];
  return provided === apiKey;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }

  if (!authorize(event)) {
    return json(401, { error: 'Invalid API key' });
  }

  const path = event.rawPath ?? event.requestContext.http.path;

  try {
    if (path.endsWith('/phone-numbers')) {
      const numbers = (process.env.PHONE_NUMBERS ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((phoneNumber) => ({ phoneNumber, label: 'Pool number' }));

      return json(200, { phoneNumbers: numbers });
    }

    if (path.endsWith('/messages')) {
      const result = await docClient.send(
        new ScanCommand({ TableName: tableName, Limit: 200 }),
      );

      const messages = ((result.Items ?? []) as Record<string, string>[])
        .map((item) => ({
          messageId: item.messageId,
          fromNumber: item.fromNumber,
          toNumber: item.toNumber,
          messageBody: item.messageBody,
          receivedAt: item.receivedAt,
        }))
        .sort(
          (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
        );

      return json(200, { messages });
    }

    return json(404, { error: 'Not found' });
  } catch (error) {
    console.error('Reader API error:', error);
    return json(500, {
      error: error instanceof Error ? error.message : 'Failed to read data',
    });
  }
};
