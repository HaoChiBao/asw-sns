# Inbound SMS Pipeline

AWS End User Messaging SMS → SNS → Lambda → DynamoDB, with a **read-only dashboard** that does not need AWS credentials.

When someone texts your AWS SMS phone number, AWS publishes the inbound payload to an SNS topic. A Lambda stores each message in DynamoDB. A separate read API (API Gateway + Lambda) exposes messages and phone numbers over HTTP. The local dashboard only calls that HTTP API.

## Architecture

```
Inbound SMS
    │
    ▼
SNS topic (inbound-sms)
    │
    ▼
Lambda (InboundSmsHandler) ──► DynamoDB (InboundSmsMessages)
                                      ▲
                                      │ read
                                      │
                               Lambda (InboundSmsReaderApi)
                                      │
                                      ▼
                               API Gateway (HTTP)
                                      │
                                      ▼
                               Dashboard (local or hosted)
                               — no AWS credentials —
```

## Project structure

```
.
├── api/                    # Read-only dashboard (Express + static UI)
│   ├── src/server.ts       # Proxies READER_API_URL
│   └── static/index.html
├── cdk/                    # AWS CDK infrastructure
├── lambda/
│   ├── src/handler.ts      # Writes inbound SMS to DynamoDB
│   └── src/reader-handler.ts  # Read API for dashboard
├── samples/
└── .env.example
```

## Prerequisites

- Node.js 20+
- AWS CLI + credentials (for **deploy only** — not needed to run the dashboard)
- AWS CDK CLI (installed via `npm install` in this repo)

## Install

```bash
npm install
cp .env.example .env
```

## Deploy infrastructure

Bootstrap CDK once per account/region:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/us-east-2
```

Deploy:

```bash
npm run deploy
```

After deploy, copy the **`ReaderApiUrl`** output into `.env`:

```bash
READER_API_URL=https://xxxx.execute-api.us-east-2.amazonaws.com
```

Optional: protect the read API with a shared key (set in CDK context or `READER_API_KEY` env when deploying, then mirror it in dashboard `.env`).

Connect two-way SMS on your pool numbers to the **`InboundSmsTopicArn`** output — see [Set up two-way SMS](https://docs.aws.amazon.com/sms-voice/latest/userguide/two-way-sms-phone-number.html).

## Dashboard (read-only)

```bash
npm run dashboard
```

Open **http://localhost:8080** (or your `PORT`). The dashboard:

- Lists **pool phone numbers** (from the read API)
- Shows **inbound messages** (newest first)
- Does **not** call AWS — only `READER_API_URL`

Set `DASHBOARD_PASSWORD` and `SESSION_SECRET` in `.env` to require sign-in.

### Host on Vercel

The dashboard deploys as a serverless Express app from the `api/` directory:

```bash
cd api
vercel link
vercel env add READER_API_URL
vercel env add DASHBOARD_PASSWORD   # optional
vercel env add SESSION_SECRET       # optional if using auth
vercel --prod
```

Or from the repo root: `npm run deploy:dashboard:prod`

Set **`READER_API_URL`** in Vercel project settings (required). No AWS credentials needed on Vercel.

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `READER_API_URL` | Dashboard | HTTP API base URL from CDK `ReaderApiUrl` output |
| `READER_API_KEY` | Dashboard | Optional — must match reader Lambda if set |
| `DASHBOARD_PASSWORD` | Dashboard | Optional login password |
| `SESSION_SECRET` | Dashboard | Cookie signing secret |
| `PORT` | Dashboard | Local server port (default 3000) |
| `AWS_REGION` | CDK deploy | Region (use `us-east-2` for this project) |
| `PHONE_NUMBERS` | CDK deploy | Comma-separated numbers shown in read API |

## Test inbound SMS

1. Deploy and wire two-way SMS to the SNS topic.
2. Text one of your pool numbers from your phone.
3. Refresh the dashboard — the message should appear within seconds.

## Troubleshooting

| Issue | Check |
| --- | --- |
| Dashboard shows “Not configured” | Set `READER_API_URL` in `.env` and restart |
| Dashboard 503 | Reader API URL wrong, or `READER_API_KEY` mismatch |
| SMS received but no message | CloudWatch logs for `InboundSmsHandler`; SNS topic wired correctly |
| Empty phone list | Redeploy with `PHONE_NUMBERS` context or env |

## Destroy stack

```bash
cd cdk && npm run destroy
```

DynamoDB uses `RETAIN` — delete the table manually if you want to remove stored messages.
