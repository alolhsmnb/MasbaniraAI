# WaveSpeed.AI — Webhook & Signature Reference

> **Last updated:** July 2025
> **Purpose:** Comprehensive reference for adding new WaveSpeed models, webhook handling, and signature verification.

---

## 1. Architecture Overview

```
User Request → POST /api/generate → WaveSpeed API (create task)
                                            ↓
                                   WaveSpeed processes task
                                            ↓
                                   POST /api/generate/callback (webhook)
                                            ↓
                                   Update Generation in DB
```

### Key Points
- **No fallback polling** — WaveSpeed models rely 100% on webhook callbacks
- Webhook URL is passed as a **query parameter**: `?webhook=https://domain/api/generate/callback`
- Each WaveSpeed API key has **its own webhook secret** (not a global setting)
- The callback endpoint is **unified** — handles both WaveSpeed and KIE.AI callbacks

---

## 2. Adding a New WaveSpeed Model

### Step 1: Add model to seed data

File: `src/app/api/admin/seed/route.ts`

```ts
const DEFAULT_MODELS = [
  // ... existing models ...
  {
    modelId: 'new-model-id',
    name: 'Display Name',
    type: 'IMAGE', // or 'VIDEO'
    provider: 'WAVESPEED', // MUST be 'WAVESPEED'
    isActive: true,
    sortOrder: 0,
  },
]
```

Or add it via Admin Panel → Models → Add Model (select provider: WaveSpeed.AI)

### Step 2: Set up pricing

File: `src/app/api/admin/pricing/route.ts` → `getDefaultPricing()`

Pricing formats:
- `resolution_quality` — 2D grid (resolution × quality) — for GPT Image 2
- `resolution` — 1D (resolution tiers) — for simple image models
- `duration` — 1D (seconds) — for Kling video
- `flat` — single price — for Veo/Seedance
- `frames` — per frame count — for Sora 2
- `duration_resolution` — 2D matrix — for Grok video

### Step 3: Frontend model constants

File: `src/components/generate-page.tsx`

```ts
const NEW_MODEL_IDS = ['new-model-id']
```

Add any model-specific settings (resolution, quality, duration, etc.)

### Step 4: Backend generation logic

File: `src/app/api/generate/route.ts`

In the `WAVESPEED` provider block, add any model-specific parameters:

```ts
if (modelProvider === 'WAVESPEED') {
  const isNewModel = model.modelId === 'new-model-id'
  
  taskResult = await createWavespeedTask({
    model: model.modelId,
    prompt: prompt.trim() || undefined,
    // Add model-specific params here
    webhookUrl,
  })
}
```

### Step 5: Frontend cost calculation

File: `src/components/generate-page.tsx` → `calculateCost` in useMemo

Handle the pricing format for the new model's cost preview.

---

## 3. Webhook Signature Verification

### How It Works

WaveSpeed signs every webhook request with HMAC-SHA256. The signature is computed from:

```
HMAC_SHA256(secret_without_prefix, "{webhook-id}.{webhook-timestamp}.{raw_body}")
```

### Headers Included

| Header | Description |
|--------|-------------|
| `webhook-id` | Unique identifier for this webhook delivery |
| `webhook-timestamp` | Unix timestamp when webhook was sent |
| `webhook-signature` | Format: `v3,<hex_signature>` |

### Signature Algorithm (Node.js)

```ts
const crypto = require('crypto')

function verifyWaveSpeedSignature(rawBuffer: Buffer, headers: Headers, secret: string): boolean {
  const webhookId = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatureHeader = headers.get('webhook-signature')

  const [version, receivedSignature] = signatureHeader.split(',')
  if (version !== 'v3') return false

  // CRITICAL: Remove whsec_ prefix from secret
  const key = secret.startsWith('whsec_') ? secret.slice(6) : secret

  // Use raw bytes (Buffer), NOT decoded string
  const prefix = Buffer.from(`${webhookId}.${timestamp}.`)
  const signedContent = Buffer.concat([prefix, rawBuffer])

  const expectedSignature = crypto
    .createHmac('sha256', key)
    .update(signedContent)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  )
}
```

### Getting the Webhook Secret

**CRITICAL:** Each API key has its own webhook secret. It is NOT a global setting.

```bash
curl -X GET 'https://api.wavespeed.ai/api/v3/webhook/secret' \
  -H 'Authorization: Bearer ${WAVESPEED_API_KEY}'
```

Response: `{ "code": 200, "data": { "secret": "whsec_..." } }`

**Important rules:**
- Remove `whsec_` prefix before using as HMAC key
- Do NOT base64 decode the remaining string
- Use the raw request body bytes (Buffer), not a decoded string

### Our Implementation

File: `src/lib/wavespeed-api.ts`
- `fetchWebhookSecret(apiKey)` — Fetches secret for one key
- `fetchAllWebhookSecrets()` — Fetches for all active keys (with 5min cache)

File: `src/app/api/generate/callback/route.ts`
- `verifyWaveSpeedSignature(rawBuffer, headers)` — Tests all fetched secrets
- Tries both stripped and full secret variants

---

## 4. Webhook Payload Format

### Completed Task

```json
{
  "id": "task-uuid",
  "model": "model-name",
  "input": { "prompt": "...", ... },
  "outputs": ["https://cdn.wavespeed.ai/output/xxx.png"],
  "urls": {
    "get": "https://api.wavespeed.ai/api/v3/predictions/task-uuid/result"
  },
  "has_nsfw_contents": null,
  "status": "completed",
  "created_at": "2025-07-...",
  "error": "",
  "timings": { "inference": 25098 }
}
```

### Failed Task

```json
{
  "id": "task-uuid",
  "model": "model-name",
  "outputs": [],
  "status": "failed",
  "error": "Error description here"
}
```

### Provider Detection

The callback endpoint auto-detects the provider:

```ts
// WaveSpeed: has id + status fields, or signature headers
if (payload.id && payload.status) → 'WAVESPEED'
if (headers.get('webhook-id')) → 'WAVESPEED'

// KIE.AI: has code + data structure
if (payload.code !== undefined && payload.data !== undefined) → 'KIE'
```

---

## 5. WaveSpeed API Request Format

### Create Task

```bash
curl -X POST 'https://api.wavespeed.ai/api/v3/{model}?webhook=https://your-domain/api/generate/callback' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer ${API_KEY}' \
  -d '{"prompt": "...", "aspect_ratio": "1:1"}'
```

Response: `{ "data": { "id": "task-uuid", "status": "pending" } }`

### Webhook URL Rules

- Must be publicly accessible HTTPS endpoint
- Must return 2xx within 20 minutes
- Passed as **query parameter**: `?webhook=<encoded_url>`
- WaveSpeed retries up to 3 times with exponential backoff on failure
- Auto-refunds credits after all retries fail

---

## 6. Common Pitfalls

| Issue | Cause | Solution |
|-------|-------|----------|
| Signature mismatch | Using wrong secret | Fetch from API per key, not global setting |
| Signature mismatch | Not removing `whsec_` prefix | Always strip prefix before HMAC |
| Signature mismatch | Using decoded string instead of raw Buffer | Use `request.arrayBuffer()` + `Buffer.from()` |
| Webhook not received | Non-HTTPS URL | Use HTTPS only |
| Webhook not received | URL not publicly accessible | Verify endpoint is reachable |
| Duplicate webhooks | Normal behavior | Use `id` field for idempotency |
| Credits not refunded on failure | Webhook status check | Always check `status === 'failed'` and refund |

---

## 7. File Reference

| File | Purpose |
|------|---------|
| `src/lib/wavespeed-api.ts` | API calls, key management, webhook secret fetching |
| `src/app/api/generate/route.ts` | Task creation, cost calculation, credit deduction |
| `src/app/api/generate/callback/route.ts` | Webhook handling, signature verification |
| `src/components/generate-page.tsx` | Frontend UI, model settings, cost preview |
| `src/app/api/admin/models/route.ts` | Admin model CRUD |
| `src/app/api/admin/pricing/route.ts` | Pricing config & defaults |
| `src/app/api/admin/seed/route.ts` | Default models seed data |
| `src/components/admin/models-tab.tsx` | Admin model management UI |

---

## 8. WaveSpeed Models Currently Supported

| Model ID | Name | Type | Pricing Format |
|----------|------|------|---------------|
| `openai/gpt-image-2/text-to-image` | GPT Image 2 (WaveSpeed) | IMAGE | resolution_quality |
| `openai/gpt-image-2/edit` | GPT Image 2 Edit (WaveSpeed) | IMAGE | resolution_quality |
| `bytedance/seedance-2.0-fast/text-to-video` | Seedance 2.0 Fast (WaveSpeed) | VIDEO | duration (5s, 10s) |
| `kwaivgi/kling-v3.0-std` | Kling 3.0 | VIDEO | duration |
| `kwaivgi/kling-v3.0-std/image-to-video` | Kling Image-to-Video | VIDEO | duration |

> To add a new model, follow the steps in Section 2.
