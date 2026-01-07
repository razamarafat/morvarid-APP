# راهنمای دیپلوی روی Cloudflare Pages

این راهنما مراحل دیپلوی اپلیکیشن Morvarid روی Cloudflare Pages را شرح می‌دهد.

## تنظیمات اولیه

### 1. آماده‌سازی پروژه
پروژه شما حالا برای دیپلوی روی هر دو پلتفرم (GitHub Pages و Cloudflare Pages) آماده است.

### 2. متغیرهای محیطی
در Cloudflare Pages، متغیرهای زیر را تنظیم کنید:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_CRYPTO_SALT=your_crypto_salt
DEPLOY_TARGET=cloudflare
```

## روش‌های دیپلوی

### روش 1: اتصال مستقیم Git Repository

1. به [Cloudflare Pages](https://pages.cloudflare.com/) بروید
2. روی "Create a project" کلیک کنید
3. "Connect to Git" را انتخاب کنید
4. Repository خود را انتخاب کنید
5. تنظیمات Build را به شرح زیر انجام دهید:
   - **Build command**: `npm run build:cloudflare`
   - **Build output directory**: `dist`
   - **Root directory**: `/`

### روش 2: استفاده از Wrangler CLI

```bash
# نصب Wrangler CLI
npm install -g wrangler

# لاگین به Cloudflare
wrangler login

# دیپلوی پروژه
npm run build:cloudflare
wrangler pages deploy dist --project-name morvarid-app
```

### روش 3: دیپلوی Manual

```bash
# ساخت پروژه برای Cloudflare
npm run build:cloudflare

# فایل‌های موجود در پوشه dist را به صورت manual آپلود کنید
```

## اسکریپت‌های موجود

- `npm run build:cloudflare` - ساخت پروژه برای Cloudflare Pages
- `npm run build:github` - ساخت پروژه برای GitHub Pages
- `npm run deploy:cloudflare` - ساخت و آماده‌سازی برای دیپلوی Cloudflare
- `npm run deploy:github` - ساخت و دیپلوی روی GitHub Pages

## تفاوت‌های کلیدی

### GitHub Pages vs Cloudflare Pages

| ویژگی | GitHub Pages | Cloudflare Pages |
|--------|--------------|------------------|
| Base Path | `/morvarid-APP/` | `/` |
| Custom Domain | محدود | کامل |
| Performance | خوب | عالی (CDN Global) |
| SSL | رایگان | رایگان + بهتر |
| Build Time | متوسط | سریع |

## بررسی موفقیت دیپلوی

پس از دیپلوی، موارد زیر را بررسی کنید:

1. **صفحه اصلی**: آیا به درستی لود می‌شود؟
2. **Routing**: آیا صفحات مختلف کار می‌کنند؟
3. **Service Worker**: آیا PWA درست کار می‌کند؟
4. **API Connection**: آیا اتصال به Supabase برقرار است؟

## عیب‌یابی

### مشکلات رایج:

1. **404 روی صفحات**: مطمئن شوید فایل `_redirects` درست تنظیم شده
2. **خطای API**: متغیرهای محیطی را بررسی کنید
3. **مشکل PWA**: Cache را پاک کنید

### لاگ‌ها:
```bash
# مشاهده لاگ‌های Build
wrangler pages deployment list --project-name morvarid-app
```

## نکات امنیتی

1. هرگز متغیرهای حساس را در کد commit نکنید
2. از Environment Variables استفاده کنید
3. HTTPS را فعال نگه دارید
4. Headers امنیتی را بررسی کنید

## بروزرسانی

برای بروزرسانی:
```bash
# تغییرات جدید
git push origin main

# یا دیپلوی manual جدید
npm run deploy:cloudflare
```