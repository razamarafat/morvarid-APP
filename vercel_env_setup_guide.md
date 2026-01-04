# راهنمای تنظیم متغیرهای محیطی در Vercel

## 🚀 مراحل اضافه کردن متغیرها در Vercel:

### 1️⃣ **ورود به پنل Vercel:**
- به https://vercel.com بروید
- وارد پنل خود شوید
- پروژه Morvarid-APP را انتخاب کنید

### 2️⃣ **رفتن به تنظیمات:**
- روی **Settings** کلیک کنید
- از منوی سمت چپ **Environment Variables** را انتخاب کنید

### 3️⃣ **اضافه کردن متغیرهای ضروری:**

#### **متغیرهای الزامی:**
```
VITE_SUPABASE_URL
Value: https://bcdyieczslyynvvsfmmm.supabase.co
Environment: Production, Preview, Development

VITE_SUPABASE_ANON_KEY  
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZHlpZWN6c2x5eW52dnNmbW1tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNDc4NzgsImV4cCI6MjA4MTcyMzg3OH0.Sun1mdhVqg1J22TR99zZhxQzqAkqByEW4-AWLy9umDY
Environment: Production, Preview, Development

VITE_CRYPTO_SALT
Value: a1b2c3d4e5f67890123456789abcdef012345678901234567890abcdef123456
Environment: Production, Preview, Development
```

### 4️⃣ **متغیرهای اختیاری (برای امنیت بیشتر):**
```
VITE_SESSION_SECRET
Value: [یک کلید تصادفی 64 کاراکتری]

VITE_JWT_SIGNING_KEY
Value: [یک کلید تصادفی 128 کاراکتری]

VITE_FILE_ENCRYPTION_KEY
Value: [یک کلید تصادفی 64 کاراکتری]

VITE_API_SECRET
Value: [یک کلید تصادفی 64 کاراکتری]
```

### 5️⃣ **Deploy مجدد:**
پس از اضافه کردن متغیرها:
- به تب **Deployments** بروید
- روی **Redeploy** کلیک کنید
- یا commit جدیدی به GitHub push کنید

## ⚠️ **نکات مهم:**
1. تمام متغیرهای `VITE_*` باید در Vercel تعریف شوند
2. مقادیر را دقیقاً مطابق فایل `.env` محلی وارد کنید
3. Environment را **Production, Preview, Development** انتخاب کنید
4. پس از اضافه کردن، حتماً redeploy کنید

## 🔗 **لینک مستقیم:**
https://vercel.com/[your-username]/morvarid-app/settings/environment-variables