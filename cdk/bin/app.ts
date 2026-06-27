#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InboundSmsStack } from '../lib/inbound-sms-stack';

const app = new cdk.App();

const region =
  app.node.tryGetContext('region') ??
  process.env.CDK_DEFAULT_REGION ??
  process.env.AWS_REGION ??
  'us-east-2';

const phoneNumbers =
  app.node.tryGetContext('phoneNumbers') ??
  process.env.PHONE_NUMBERS ??
  '+12362051147,+18257730586';

const readerApiKey =
  app.node.tryGetContext('readerApiKey') ?? process.env.READER_API_KEY;

new InboundSmsStack(app, 'InboundSmsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
  },
  phoneNumbers,
  readerApiKey,
});
