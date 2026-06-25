# Inbound SMS Pipeline

AWS End User Messaging SMS → SNS → Lambda → DynamoDB

When someone texts your AWS SMS phone number, AWS publishes the inbound payload to an SNS topic. This project deploys that topic, a Lambda function (`InboundSmsHandler`), and a DynamoDB table (`InboundSmsMessages`) to parse and store each message.

## Why AWS CDK?

This project uses **AWS CDK (TypeScript)** instead of Terraform because:

- The Lambda handler and infrastructure are both TypeScript — one language end to end.
- CDK has first-class constructs for SNS → Lambda subscriptions, DynamoDB grants, and Lambda bundling.
- Less boilerplate than Terraform for wiring IAM permissions and Lambda packaging.

Terraform would work equally well if you prefer HCL or already standardize on it.

## Architecture

```
AWS End User Messaging SMS phone number
        │
        ▼
   SNS topic (inbound-sms)
        │
        ▼
   Lambda (InboundSmsHandler)
        │
        ▼
   DynamoDB (InboundSmsMessages)
```

## Project structure

```
.
├── cdk/                    # AWS CDK infrastructure
│   ├── bin/app.ts
│   └── lib/inbound-sms-stack.ts
├── lambda/                 # Lambda source
│   ├── src/
│   │   ├── handler.ts
│   │   ├── storage.ts
│   │   └── types.ts
│   └── scripts/invoke-local.ts
├── samples/
│   └── sns-inbound-sms-event.json
├── .env.example
└── README.md
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS CDK CLI (installed via `npm install` in this repo)

## Install

```bash
npm install
```

Copy environment defaults:

```bash
cp .env.example .env
```

Edit `.env` if you deploy to a region other than `us-east-1`.

## Configure AWS credentials

Use one of these approaches:

**AWS CLI profile (recommended)**

```bash
aws configure
# or: export AWS_PROFILE=your-profile
```

**Environment variables**

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
```

Verify:

```bash
aws sts get-caller-identity
```

## Deploy infrastructure

Bootstrap CDK in your account/region (first time only):

```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
# example: npx cdk bootstrap aws://123456789012/us-east-1
```

Preview changes:

```bash
npm run diff
```

Deploy:

```bash
npm run deploy
```

After deployment, note the **`InboundSmsTopicArn`** output — you need it for two-way SMS configuration.

To print outputs again:

```bash
cd cdk && npx cdk deploy --outputs-file ../cdk-outputs.json
cat cdk-outputs.json
```

## Connect SNS to your AWS SMS phone number

1. Open the [AWS End User Messaging SMS console](https://console.aws.amazon.com/sms-voice/home).
2. Go to **Phone numbers** and select your SMS-capable number.
3. Under **Two-way SMS**, choose **Edit**.
4. Set **Destination type** to **Amazon SNS**.
5. Select **Existing Amazon SNS topic** and paste the **`InboundSmsTopicArn`** from the deploy output.
6. For **Two-way channel role**, choose **Use Amazon SNS topic policies** (the CDK stack already adds the required `sms-voice.amazonaws.com` publish permission).
7. Save.

Reference: [Set up two-way SMS](https://docs.aws.amazon.com/sms-voice/latest/userguide/two-way-sms-phone-number.html)

## Test locally

Dry run (default — parses the sample event and logs output, skips DynamoDB):

```bash
npm run test:local
```

Write to DynamoDB (requires deployed table and AWS credentials):

```bash
npm run test:local -- --write
```

The sample event is in `samples/sns-inbound-sms-event.json` and includes:

- `originationNumber`: `+14255550182`
- `destinationNumber`: `+12125550101`
- `messageBody`: `"hello from test"`
- `inboundMessageId`: `cae173d2-66b9-564c-8309-21f858e9fb84`

## Test with a real SMS

1. Deploy the stack and connect the SNS topic to your phone number (above).
2. Send a text message to your AWS SMS number from your mobile phone.
3. Within a few seconds, the Lambda should run and store the message.

## Check CloudWatch logs

```bash
aws logs tail /aws/lambda/InboundSmsHandler --follow
```

Or in the console: **CloudWatch → Log groups → `/aws/lambda/InboundSmsHandler`**.

Look for:

- `Raw SNS event:` — full incoming event
- `Processed inbound SMS:` — parsed fields

## View stored messages in DynamoDB

**CLI — scan recent items**

```bash
aws dynamodb scan \
  --table-name InboundSmsMessages \
  --max-items 10
```

**CLI — get by message id**

```bash
aws dynamodb get-item \
  --table-name InboundSmsMessages \
  --key '{"messageId":{"S":"YOUR_INBOUND_MESSAGE_ID"}}'
```

**Console:** DynamoDB → Tables → `InboundSmsMessages` → Explore table items.

### Stored fields

| Field | Description |
| --- | --- |
| `messageId` | Primary key (`inboundMessageId` or generated UUID) |
| `fromNumber` | Sender (`originationNumber`) |
| `toNumber` | Your AWS number (`destinationNumber`) |
| `messageBody` | SMS text |
| `receivedAt` | SNS timestamp |
| `rawPayload` | Full parsed inbound JSON |

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `AWS_REGION` | CDK / local SDK | AWS region (e.g. `us-east-1`) |
| `DYNAMODB_TABLE_NAME` | Lambda | Table name (set automatically on deploy) |
| `LOCAL_DRY_RUN` | Local script only | Skip DynamoDB writes when `true` |

See `.env.example` for a template.

## Destroy stack

```bash
cd cdk && npm run destroy
```

The DynamoDB table uses `RETAIN` removal policy — it is kept after stack deletion to avoid accidental data loss. Delete it manually in the console if needed.

## Troubleshooting

| Issue | Check |
| --- | --- |
| SMS received but Lambda not invoked | SNS topic ARN matches deploy output; two-way SMS is enabled on the number |
| Lambda permission denied on SNS | Redeploy — CDK creates the subscription and invoke permission |
| DynamoDB access denied | Lambda role has write grant from CDK (`table.grantWriteData`) |
| Empty `fromNumber` / `messageBody` | Inspect `Raw SNS event` in CloudWatch; payload shape may differ |

## License

Private / use as needed for your app.
