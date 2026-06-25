import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DescribePhoneNumbersCommand,
  DescribePoolsCommand,
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION ?? 'us-east-2';
const poolId = process.env.POOL_ID ?? 'pool-beaed95ac15e49bd9dfcc1e62689236d';
const tableName = process.env.DYNAMODB_TABLE_NAME ?? 'InboundSmsMessages';

const smsClient = new PinpointSMSVoiceV2Client({ region });
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

export interface PoolView {
  poolId: string;
  status: string;
  messageType: string;
  twoWayEnabled: boolean;
  twoWayChannelArn?: string;
  phoneNumbers: PhoneNumberView[];
}

export interface PhoneNumberView {
  phoneNumberId: string;
  phoneNumber: string;
  status: string;
  numberType: string;
  twoWayEnabled: boolean;
  isoCountryCode?: string;
}

export interface InboundMessageView {
  messageId: string;
  fromNumber: string;
  toNumber: string;
  messageBody: string;
  receivedAt: string;
}

export async function getPoolOverview(): Promise<PoolView> {
  const [poolResult, phoneResult] = await Promise.all([
    smsClient.send(new DescribePoolsCommand({ PoolIds: [poolId] })),
    smsClient.send(new DescribePhoneNumbersCommand({ PoolId: poolId })),
  ]);

  const pool = poolResult.Pools?.[0];
  if (!pool) {
    throw new Error(`Pool not found: ${poolId}`);
  }

  return {
    poolId: pool.PoolId ?? poolId,
    status: pool.Status ?? 'UNKNOWN',
    messageType: pool.MessageType ?? 'UNKNOWN',
    twoWayEnabled: pool.TwoWayEnabled ?? false,
    twoWayChannelArn: pool.TwoWayChannelArn,
    phoneNumbers: (phoneResult.PhoneNumbers ?? []).map((phone) => ({
      phoneNumberId: phone.PhoneNumberId ?? '',
      phoneNumber: phone.PhoneNumber ?? '',
      status: phone.Status ?? 'UNKNOWN',
      numberType: phone.NumberType ?? 'UNKNOWN',
      twoWayEnabled: phone.TwoWayEnabled ?? false,
      isoCountryCode: phone.IsoCountryCode,
    })),
  };
}

export async function listInboundMessages(limit = 50): Promise<InboundMessageView[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: tableName,
      Limit: limit,
    }),
  );

  const items = (result.Items ?? []) as InboundMessageView[];
  return items.sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

export async function sendSms(
  destinationPhoneNumber: string,
  messageBody: string,
  originationIdentity?: string,
): Promise<{ messageId?: string }> {
  const pool = await getPoolOverview();
  const defaultOrigin =
    pool.phoneNumbers.find((p) => p.numberType === 'LONG_CODE' && p.status === 'ACTIVE')
      ?.phoneNumber ?? poolId;

  const result = await smsClient.send(
    new SendTextMessageCommand({
      DestinationPhoneNumber: destinationPhoneNumber,
      MessageBody: messageBody,
      OriginationIdentity: originationIdentity ?? defaultOrigin,
      MessageType: 'TRANSACTIONAL',
    }),
  );

  return { messageId: result.MessageId };
}
