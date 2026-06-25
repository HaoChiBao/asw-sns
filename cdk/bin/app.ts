#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InboundSmsStack } from '../lib/inbound-sms-stack';

const app = new cdk.App();

new InboundSmsStack(app, 'InboundSmsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
  },
});
