import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { join } from 'node:path';

export class InboundSmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'InboundSmsMessagesTable', {
      tableName: 'InboundSmsMessages',
      partitionKey: {
        name: 'messageId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const topic = new sns.Topic(this, 'InboundSmsTopic', {
      topicName: 'inbound-sms',
      displayName: 'Inbound SMS from AWS End User Messaging',
    });

    // Allow AWS End User Messaging SMS to publish inbound messages to this topic.
    topic.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowSmsVoicePublish',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('sms-voice.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
      }),
    );

    const inboundSmsHandler = new NodejsFunction(this, 'InboundSmsHandler', {
      functionName: 'InboundSmsHandler',
      entry: join(__dirname, '../../lambda/src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DYNAMODB_TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
      },
    });

    table.grantWriteData(inboundSmsHandler);

    topic.addSubscription(new snsSubscriptions.LambdaSubscription(inboundSmsHandler));

    new cdk.CfnOutput(this, 'InboundSmsTopicArn', {
      value: topic.topicArn,
      description: 'Paste this ARN into AWS End User Messaging SMS two-way SMS settings',
      exportName: 'InboundSmsTopicArn',
    });

    new cdk.CfnOutput(this, 'InboundSmsHandlerArn', {
      value: inboundSmsHandler.functionArn,
      description: 'Lambda function ARN for inbound SMS processing',
    });

    new cdk.CfnOutput(this, 'InboundSmsMessagesTableName', {
      value: table.tableName,
      description: 'DynamoDB table storing inbound SMS messages',
    });
  }
}
