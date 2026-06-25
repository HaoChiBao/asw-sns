import type { SNSEvent, SNSEventRecord, SNSHandler } from 'aws-lambda';

/** Payload published by AWS End User Messaging SMS to SNS. */
export interface InboundSmsPayload {
  originationNumber?: string;
  destinationNumber?: string;
  messageBody?: string;
  inboundMessageId?: string;
  messageKeyword?: string;
  previousPublishedMessageId?: string;
}

/** Normalized inbound SMS record stored in DynamoDB. */
export interface InboundSmsMessage {
  messageId: string;
  fromNumber: string;
  toNumber: string;
  messageBody: string;
  receivedAt: string;
  rawPayload: unknown;
}

export interface HandlerResponse {
  statusCode: number;
  body: string;
}

export interface ProcessRecordResult {
  messageId?: string;
  error?: string;
}

export type InboundSmsHandler = SNSHandler;

export type { SNSEvent, SNSEventRecord };
