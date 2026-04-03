# 📖 PixelForge AI - دليل التشغيل والنشر الشامل

---

## 📋 محتويات الدليل

1. [المتطلبات الأساسية](#-المتطلبات-الأساسية)
2. [تشغيل المشروع محلياً](#-تشغيل-المشروع-محليا)
3. [شرح المتغيرات البيئية (.env)](#-شرح-المتغيرات-البيئية-env)
4. [إعداد قاعدة البيانات](#-إعداد-قاعدة-البيانات)
5. [نشر على Vercel](#-نشر-على-vercel-الأسهل)
6. [نشر على Netlify](#-نشر-على-netlify)
7. [نشر على Railway](#-نشر-على-railway)
8. [نشر على VPS / Dedicated Server](#-نشر-على-vps--dedicated-server)
9. [نشر باستخدام Docker](#-نشر-باستخدام-docker)
10. [إعداد Google OAuth](#-إعداد-google-oauth)
11. [إظام CryptAPI للدفع بالعملات الرقمية](#-نظام-cryptapi-للدفع-بالعملات-الرقمية)
12. [إعداد KIE.AI API](#-إعداد-kieai-api)
13. [حل المشاكل الشائعة](#-حل-المشاكل-الشائعة)

---

## 🔧 المتطلبات الأساسية

| الأداة | الإصدار المطلوب | للتحميل |
|--------|----------------|---------|
| **Node.js** | 18+ | https://nodejs.org |
| **Bun** | 1.0+ (أو npm/pnpm/yarn) | https://bun.sh |
| **PostgreSQL** | 14+ | https://www.postgresql.org |
| **Git** | آخر إصدار | https://git-scm.com |
| **Prisma CLI** | 6.x | يُثبّت تلقائياً مع المشروع |

---

## 🖥 تشغيل المشروع محلياً

### الخطوة 1: استنساخ المشروع

```bash
git clone <رابط-المشروع>
cd pixelforge-ai
```

### الخطوة 2: تثبيت الحزم

```bash
bun install
# أو
npm install
# أو
pnpm install
```

### الخطوة 3: إعداد ملف `.env`

أنشئ ملف `.env` في الجذر بنسخة من `.env.example` (إن وُجد) أو أنشئه يدوياً:

```bash
cp .env.example .env
```

ثم عدّل القيم كما هو موضح في [قسم المتغيرات البيئية](#-شرح-المتغيرات-البيئية-env).

### الخطوة 4: إعداد قاعدة البيانات

```bash
# توليد Prisma Client
bunx prisma generate

# دفع الـ Schema لقاعدة البيانات
bunx prisma db push
```

### الخطوة 5: تشغيل خادم التطوير

```bash
bun run dev
```

افتح المتصفح على: `http://localhost:3000`

---

## 🔐 شرح المتغيرات البيئية (.env)

### ملف `.env` الكامل:

```env
# ===== قاعدة البيانات =====
# رابط اتصال PostgreSQL (مطلوب)
DATABASE_URL=postgresql://اسم_المستخدم:كلمة_المرور@الخادم:5432/اسم_القاعدة
# رابط مباشر لعمليات الـ Migration (مطلوب)
DIRECT_DATABASE_URL=postgresql://اسم_المستخدم:كلمة_المرور@الخادم:5432/اسم_القاعدة

# ===== Google OAuth =====
# من Google Cloud Console (مطلوب لتسجيل الدخول)
GOOGLE_CLIENT_ID=أي-أيدي-التطبيق-من-جوجل.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx

# ===== الأمان =====
# سر مشفّر للجلسات (غيّره لقيمة عشوائية قوية)
NEXTAUTH_SECRET=أنشئ-سر-عشوائي-قوي-هنا
# رابط الموقع الكامل (مهم جداً لـ OAuth)
NEXTAUTH_URL=https://موقعك.com

# ===== إعدادات اختيارية =====
# البريد الإلكتروني للمسؤول
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
```

### شرح كل متغير بالتفصيل:

| المتغير | مطلوب؟ | الشرح |
|---------|--------|-------|
| `DATABASE_URL` | ✅ نعم | رابط اتصال PostgreSQL. يمكن أن يكون Supabase, Neon, Railway, أو أي خادم PostgreSQL |
| `DIRECT_DATABASE_URL` | ✅ نعم | نفس الرابط أو رابط مباشر بدون Pooler - ضروري لعمليات Migration |
| `GOOGLE_CLIENT_ID` | ✅ نعم | Client ID من Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | ✅ نعم | Client Secret من نفس المكان |
| `NEXTAUTH_SECRET` | ✅ نعم | سر للتشفير - أنشئه بـ `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ نعم | رابط موقعك الكامل مع HTTPS بدون شرطة مائلة في النهاية |
| `NEXT_PUBLIC_ADMIN_EMAIL` | ❌ لا | البريد الذي سيصبح مسؤول تلقائياً عند أول تسجيل دخول |

### كيفية إنشاء NEXTAUTH_SECRET:

```bash
# على Linux/Mac
openssl rand -base64 32

# على Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🗄 إعداد قاعدة البيانات

### الخيار 1: Supabase (مجاني وموصى به)

1. اذهب إلى https://supabase.com وإنشئ حساب
2. أنشئ مشروع جديد (Project)
3. من **Settings → Database → Connection string**:
   - **DATABASE_URL**: استخدم الـ Session Mode Pooler (المنفذ 5432):
     ```
     postgresql://postgres.[مشروع-id]:[كلمة-المرور]@aws-0-[region].pooler.supabase.com:5432/postgres
     ```
   - **DIRECT_DATABASE_URL**: نفس الرابط أو استخدم الـ Direct connection

### الخيار 2: Neon (مجاني)

1. اذهب إلى https://neon.tech
2. أنشئ مشروع
3. انسخ رابط الاتصال من لوحة التحكم

### الخيار 3: قاعدة محلية (للتطوير فقط)

```bash
# تثبيت PostgreSQL
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# إنشاء قاعدة بيانات
sudo -u postgres createdb pixelforge
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'كلمة-المرور';"
```

ثم في `.env`:
```env
DATABASE_URL=postgresql://postgres:كلمة-المرور@localhost:5432/pixelforge
DIRECT_DATABASE_URL=postgresql://postgres:كلمة-المرور@localhost:5432/pixelforge
```

### الخيار 4: Railway (مدفوع مع خطة مجانية)

1. اذهب إلى https://railway.app
2. أنشئ مشروع جديد → New → PostgreSQL
3. انسخ المتغير `DATABASE_URL` من المتغيرات البيئية

---

## 🚀 نشر على Vercel (الأسهل)

Vercel هو المنصة الأسهل لنشر تطبيقات Next.js.

### الخطوة 1: إعداد next.config.ts

أضف `output: 'standalone'` للإنتاج:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
```

### الخطوة 2: النشر

**الطريقة أ: من GitHub:**
1. ارفع المشروع على GitHub
2. اذهب إلى https://vercel.com
3. سجّل الدخول بـ GitHub
4. انقر **"Import Project"** → اختر المستودع
5. أضف المتغيرات البيئية في **Settings → Environment Variables**:

| المتغير | القيمة |
|---------|--------|
| `DATABASE_URL` | رابط PostgreSQL |
| `DIRECT_DATABASE_URL` | رابط PostgreSQL مباشر |
| `GOOGLE_CLIENT_ID` | من Google Console |
| `GOOGLE_CLIENT_SECRET` | من Google Console |
| `NEXTAUTH_SECRET` | سر عشوائي |
| `NEXTAUTH_URL` | `https://اسم-مشروعك.vercel.app` |

6. انقر **Deploy**

**الطريقة ب: باستخدام Vercel CLI:**

```bash
# تثبيت Vercel CLI
npm i -g vercel

# تسجيل الدخول
vercel login

# نشر
vercel

# إعداد المتغيرات البيئية
vercel env add DATABASE_URL
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add NEXTAUTH_SECRET
vercel env add NEXTAUTH_URL

# نشر للإنتاج
vercel --prod
```

### الخطوة 3: إعداد قاعدة البيانات

بعد النشر، شغّل أمر Migration:

```bash
# تثبيت Vercel CLI وضبط البيئة
vercel link

# دفع Schema لقاعدة البيانات
vercel env pull .env.local
bunx prisma db push
```

> ⚠️ **ملاحظة مهمة**: Vercel has read-only filesystem. الـ API routes التى تحتاج الكتابة على الملفات لن تعمل. تأكد إن كل البيانات بتتخزن فى قاعدة البيانات.

---

## 🌐 نشر على Netlify

Netlify لا يدعم Next.js API routes تلقائياً. تحتاج إعداد إضافي.

### الطريقة 1: باستخدام Netlify + Next.js Runtime (الطريقة الجديدة)

Netlify دعم Next.js رسمياً لكن محدود:

```bash
# تثبيت Netlify CLI
npm i -g netlify-cli

# تسجيل الدخول
netlify login

# بناء المشروع
bun run build

# نشر
netlify deploy --prod --dir=.next/standalone
```

> ⚠️ **تحذير**: Netlify لا يدعم:
> - Server-side Rendering كامل
> - API Routes بشكل موثوق
> - WebSocket
> - Prisma Db Push من الـ CLI
>
> **Netlify ليس موصى به لهذا المشروع** لاعتماده الكبير على API routes وقاعدة البيانات.

### الطريقة 2: إعداد netlify.toml (إن أردت التجربة)

أنشئ ملف `netlify.toml` في الجذر:

```toml
[build]
  command = "bun run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

### المتغيرات البيئية على Netlify:

1. اذهب إلى **Site settings → Environment variables**
2. أضف كل المتغيرات من ملف `.env`
3. أعد النشر

---

## 🚂 نشر على Railway (موصى به كبديل)

Railway يدعم Next.js و PostgreSQL معاً.

### الخطوة 1:

1. اذهب إلى https://railway.app
2. سجّل الدخول بـ GitHub
3. انقر **"New Project"** → **"Deploy from GitHub repo"**
4. اختر مستودع المشروع

### الخطوة 2: إضافة PostgreSQL

1. داخل المشروع، انقر **"New"** → **"Add Service"** → **"Database"** → **"Add PostgreSQL"**
2. سيتم إنشاء قاعدة بيانات تلقائياً

### الخطوة 3: ربط المتغيرات

Railway يربط `DATABASE_URL` تلقائياً. أضف المتغيرات الباقية:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### الخطوة 4: أمر البناء

- **Build Command**: `bun run build`
- **Start Command**: `bun run start`

### الخطوة 5: تشغيل Migration

من **Railway → Database → Connect**:

```bash
railway connect
# ثم من terminal
bunx prisma db push
```

---

## 🖧 نشر على VPS / Dedicated Server

هذا الخيار يعطيك تحكم كامل. مثال على Ubuntu 22.04:

### الخطوة 1: تثبيت المتطلبات

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت Bun
curl -fsSL https://bun.sh/install | bash

# تثبيت PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# تثبيت Nginx (reverse proxy)
sudo apt install -y nginx certbot python3-certbot-nginx

# تثبيت PM2 (process manager)
sudo npm install -g pm2
```

### الخطوة 2: إعداد PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE pixelforge;
CREATE USER pixelforge WITH PASSWORD 'كلمة-مرور-قوية';
GRANT ALL PRIVILEGES ON DATABASE pixelforge TO pixelforge;
\q
```

### الخطوة 3: نشر المشروع

```bash
# استنساخ المشروع
cd /var/www
git clone <رابط-المشروع> pixelforge
cd pixelforge

# تثبيت الحزم
bun install

# إعداد .env
nano .env
# أضف كل المتغيرات البيئية

# توليد Prisma Client
bunx prisma generate

# دفع Schema
bunx prisma db push

# بناء المشروع
bun run build
```

### الخطوة 4: تشغيل بـ PM2

أنشئ ملف `ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'pixelforge',
    script: '.next/standalone/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }]
}
```

ثم:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### الخطوة 5: إعداد Nginx

أنشئ ملف `/etc/nginx/sites-available/pixelforge`:

```nginx
server {
    listen 80;
    server_name موقعك.com www.موقعك.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pixelforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# إضافة SSL (Let's Encrypt)
sudo certbot --nginx -d موقعك.com -d www.موقعك.com
```

### الخطوة 6: إعداد Firewall

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### الخطوة 7: تحديث NEXTAUTH_URL

```env
NEXTAUTH_URL=https://موقعك.com
```

---

## 🐳 نشر باستخدام Docker

### الخطوة 1: إنشاء Dockerfile

أنشئ ملف `Dockerfile` في الجذر:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json bun.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f bun.lock ]; then bun install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bunx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### الخطوة 2: إنشاء docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:كلمة-المرور@db:5432/pixelforge
      - DIRECT_DATABASE_URL=postgresql://postgres:كلمة-المرور@db:5432/pixelforge
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: كلمة-المرور
      POSTGRES_DB: pixelforge
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

### الخطوة 3: إنشاء .dockerignore

```
node_modules
.next
.git
.env
*.md
```

### الخطوة 4: تشغيل

```bash
# بناء وتشغيل
docker compose up -d --build

# تشغيل Migration (مرة واحدة)
docker compose exec app bunx prisma db push

# عرض السجلات
docker compose logs -f app

# إيقاف
docker compose down

# إيقاف مع حذف البيانات
docker compose down -v
```

---

## 🔑 إعداد Google OAuth

### 1. إنشاء مشروع في Google Cloud Console

1. اذهب إلى https://console.cloud.google.com
2. انقر **"Select a project"** → **"New Project"**
3. أعطِ المشروع اسم (مثلاً: PixelForge AI)
4. اختر المنظمة واضغط Create

### 2. تفعيل Google Identity API

1. من القائمة الجانبية: **APIs & Services → Library**
2. ابحث عن **"Google Identity"**
3. اضغط **"Enable"**

### 3. إنشاء OAuth 2.0 Credentials

1. اذهب إلى **APIs & Services → Credentials**
2. انقر **"Create Credentials"** → **"OAuth client ID"**
3. اختر **"Web application"**
4. أعطِه اسم (مثلاً: PixelForge Web App)
5. **Authorized JavaScript origins**: أضف رابط موقعك:
   - `https://موقعك.com`
   - `http://localhost:3000` (للتطوير)
6. **Authorized redirect URIs**: أضف:
   - `https://موقعك.com/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (للتطوير)
7. اضغط **Create**
8. **انسخ Client ID و Client Secret** - ستحتاجهما في `.env`

### 4. إعداد الشاشة بتعلیم OAuth

1. اذهب إلى **APIs & Services → OAuth consent screen**
2. اختر **External** واضغط Create
3. املأ المعلومات الأساسية (الاسم، البريد، الخ)
4. في **Scopes**: أضف `openid`, `email`, `profile`
5. في **Test Users**: أضف بريدك الإلكتروني (في وضع الاختبار)
6. للنشر العام: اضغط **"Publish App"**

### 5. حفظ الإعدادات في قاعدة البيانات

بعد أول تسجيل دخول ناجح، يمكنك حفظ الإعدادات في لوحة تحكم المسؤول (Admin → Google Auth). أو يدوياً:

```sql
INSERT INTO "SiteSetting" ("key", "value") VALUES
  ('google_client_id', 'الأي-دي-الخاص-بك'),
  ('google_client_secret', 'السير-الخاص-بك'),
  ('google_redirect_uri', 'https://موقعك.com/api/auth/google/callback')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
```

---

## 💰 نظام CryptAPI للدفع بالعملات الرقمية

### 1. إنشاء حساب في CryptAPI

1. اذهب إلى https://cryptapi.io
2. أنشئ حساب
3. من لوحة التحكم: **Merchants → Create New Merchant**

### 2. إعداد API Key

1. اذهب إلى **Settings → API**
2. انسخ الـ **API Key** و **API Password**

### 3. إعداد العملات

1. من **Merchants → Your Merchant → Coins**
2. فعّل العملات المطلوبة (BTC, ETH, USDT, etc.)
3. لكل عملة: أضف عنوان الاستلام (Wallet Address)

### 4. إعداد Callback URL

في إعدادات Merchant:
- **Callback URL**: `https://موقعك.com/api/crypto/webhook`

### 5. حفظ الإعدادات في لوحة التحكم

من **Admin → Crypto** في التطبيق:
- أضف الـ API Key
- أضف الـ API Password
- أضف عنوان المحفظة لكل عملة

---

## 🤖 إعداد KIE.AI API

نظام توليد الصور والفيديو يعتمد على KIE.AI API.

### 1. الحصول على API Key

1. اذهب إلى https://kie.ai
2. سجّل الدخول واحصل على API Key
3. أو استخدم الـ endpoint مباشرة إن كان متاح

### 2. حفظ API Key

في لوحة تحكم المسؤول (Admin → API Keys):
- أضف الـ KIE AI API Key

### 3. النماذج المدعومة

| النوع | النموذج | Model ID |
|-------|---------|----------|
| صور | Google Nano Banana Pro | `nano-banana-pro` |
| صور | Google Nano Banana 2 | `nano-banana-2` |
| صور | Grok Imagine T2I | `grok-imagine/text-to-image` |
| صور | Grok Imagine I2I | `grok-imagine/image-to-image` |
| فيديو | Veo3.1 | `veo3_fast` |
| فيديو | Sora2 T2V | `sora-2-text-to-video` |
| فيديو | Sora2 I2V | `sora-2-image-to-video` |
| فيديو | Grok Imagine T2V | `grok-imagine/text-to-video` |
| فيديو | Grok Imagine I2V | `grok-imagine/image-to-video` |

---

## 🔧 حل المشاكل الشائعة

### مشكلة: `EADDRINUSE: address already in use :::3000`

```bash
# اقتل العملية على المنفذ 3000
lsof -ti:3000 | xargs kill -9

# أو على Linux
fuser -k 3000/tcp
```

### مشكلة: `prisma db push` يفشل

```bash
# تأكد من صحة رابط قاعدة البيانات
# جرّب الاتصال يدوياً
psql "رابط-الاتصال"

# أعد توليد Prisma Client
bunx prisma generate
bunx prisma db push
```

### مشكلة: تسجيل الدخول يرجع للصفحة الرئيسية

1. تأكد من `NEXTAUTH_URL` يطابق رابط الموقع بالضبط
2. تأكد من `redirect_uri` في Google Console يطابق: `https://موقعك.com/api/auth/google/callback`
3. امسح ملفات الكوكى من المتصفح
4. تحقق من أن المتغيرات البيئية محملة:

```bash
# في Terminal، اختبر
curl -s https://موقعك.com/api/auth/me
```

### مشكلة: CORS Errors

تأكد من إضافة النطاق في Google Console:
- **Authorized JavaScript origins**: `https://موقعك.com`
- **Authorized redirect URIs**: `https://موقعك.com/api/auth/google/callback`

### مشكلة: `cannot reassign to a variable declared with const`

هذا خطأ في TypeScript. تأكد إن المتغيرات اللى بتعيد تعيينها معرّفة بـ `let` مش `const`.

### مشكلة: التطبيق بطيء بعد النشر

1. فعّل التخزين المؤقت (Caching) في CDN
2. تأكد من `output: 'standalone'` في next.config.ts
3. استخدم PostgreSQL قريبة من موقع المستخدمين (Supabase فيه مناطق متعددة)

### مشكلة: الخطأ `Invalid `prisma.user.findMany()` invocation`

```bash
# أعد توليد Prisma Client
bunx prisma generate

# أعد بناء المشروع
rm -rf .next
bun run build
```

### مشكلة: الـ Credits لا تتحدث

1. تأكد من إعداد `daily_free_credits` في جدول `SiteSetting`
2. تأكد إن `lastCreditReset` لل用户 ليس فارغ
3. راجع قاعدة البيانات:
```sql
SELECT * FROM "SiteSetting" WHERE key = 'daily_free_credits';
SELECT email, "dailyCredits", "paidCredits", "lastCreditReset" FROM "User";
```

---

## 📁 هيكل المشروع

```
pixelforge-ai/
├── prisma/
│   ├── schema.prisma          # Schema لقاعدة البيانات
│   └── migrations/            # ملفات Migration
├── public/                    # ملفات ثابتة
├── src/
│   ├── app/
│   │   ├── page.tsx           # الصفحة الرئيسية (SPA)
│   │   ├── layout.tsx         # التخطيط العام
│   │   └── api/
│   │       ├── auth/          # API تسجيل الدخول/الخروج
│   │       │   ├── google/    # Google OAuth
│   │       │   ├── me/        # بيانات المستخدم الحالي
│   │       │   ├── logout/    # تسجيل الخروج
│   │       │   └── set-session/ # تعيين الجلسة
│   │       ├── user/
│   │       │   └── credits/   # رصيد المستخدم
│   │       ├── generate/      # API توليد الصور/الفيديو
│   │       ├── crypto/        # API الدفع بالكريبتو
│   │       ├── admin/         # API لوحة التحكم
│   │       └── public/        # API عامة (الإعدادات)
│   ├── components/
│   │   ├── ui/                # مكونات shadcn/ui
│   │   ├── generate-page.tsx  # صفحة التوليد
│   │   ├── history-page.tsx   # صفحة السجل
│   │   ├── landing-page.tsx   # الصفحة الرئيسية
│   │   ├── navbar.tsx         # شريط التنقل
│   │   └── admin-dashboard.tsx # لوحة التحكم
│   ├── lib/
│   │   ├── auth.ts            # نظام المصادقة (JWT)
│   │   ├── db.ts              # اتصال Prisma
│   │   ├── cryptapi.ts        # تكامل CryptAPI
│   │   └── credits.ts         # نظام الكريديتس
│   └── store/
│       └── app-store.ts       # Zustand store
├── .env                       # المتغيرات البيئية (لا ترفعه!)
├── next.config.ts             # إعدادات Next.js
├── package.json               # الحزم والسكريبتات
├── tsconfig.json              # إعدادات TypeScript
└── Caddyfile                  # إعداد Caddy (للتطوير)
```

---

## 🎯 مقارنة منصات النشر

| المنصة | الصعوبة | السعر | API Routes | PostgreSQL | التوصية |
|--------|---------|-------|------------|------------|---------|
| **Vercel** | ⭐ سهل جداً | مجاني + مدفوع | ✅ كامل | ❌ خارجي | ⭐⭐⭐⭐⭐ |
| **Railway** | ⭐⭐ سهل | مجاني محدود + مدفوع | ✅ كامل | ✅ مدمج | ⭐⭐⭐⭐⭐ |
| **Netlify** | ⭐⭐⭐ متوسط | مجاني + مدفوع | ⚠️ محدود | ❌ خارجي | ⭐⭐ |
| **VPS** | ⭐⭐⭐⭐ متقدم | حسب الخادم | ✅ كامل | ✅ مدمج | ⭐⭐⭐⭐ |
| **Docker** | ⭐⭐⭐⭐ متقدم | حسب الخادم | ✅ كامل | ✅ مدمج | ⭐⭐⭐⭐ |

### التوصية:
- **للمبتدئين**: Vercel + Supabase (مجاني)
- **للإنتاج**: VPS مع Docker أو Railway
- **تجنب**: Netlify (لا يدعم API routes بشكل موثوق لهذا المشروع)

---

## ✅ قائمة التحقق قبل النشر

- [ ] ملف `.env` يحتوي كل المتغيرات المطلوبة
- [ ] `NEXTAUTH_URL` يطابق رابط الموقع
- [ ] Google OAuth: `redirect_uri` يطابق رابط الموقع
- [ ] قاعدة البيانات متصلة و Migration تم تشغيلها
- [ ] `prisma generate` تم تشغيله
- [ ] المشروع يبنى بنجاح: `bun run build`
- [ ] البريد الإلكتروني للمسؤول محدد (اختياري)
- [ ] KIE.AI API Key محفوظ في قاعدة البيانات
- [ ] CryptAPI إعدادات محفوظة (اختياري)
- [ ] SSL/HTTPS مفعّل (ضروري لـ OAuth)
- [ ] CORS مُعدّل في Google Console

---

*PixelForge AI - دليل التشغيل والنشر v1.0*
