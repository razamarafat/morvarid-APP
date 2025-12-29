
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Check for Environment Variables (CI/CD/Vercel Mode)
// In Vercel, variables are injected into process.env, so physical file is not needed.
const hasEnvVars = 
    process.env.VITE_SUPABASE_URL && 
    process.env.VITE_SUPABASE_URL.length > 0;

// 2. Check for Physical .env File (Local Development Mode)
const envPath = path.resolve(__dirname, '../.env');
const hasEnvFile = fs.existsSync(envPath);

// Decision Logic
if (hasEnvVars) {
    console.log('\x1b[32m%s\x1b[0m', ' ✅ Environment variables detected in process (CI/CD Mode). Skipping file check.');
} else if (hasEnvFile) {
    console.log('\x1b[32m%s\x1b[0m', ' ✅ Local .env file found (Development Mode). Starting app...');
} else {
    // Both missing -> Critical Error
    console.log('\n');
    console.error('\x1b[41m\x1b[37m%s\x1b[0m', ' [CRITICAL ERROR] Missing Environment Configuration ');
    console.error('\x1b[31m%s\x1b[0m', ' --------------------------------------------------- ');
    console.error('\x1b[31m%s\x1b[0m', ' ❌ نه متغیرهای محیطی یافت شدند و نه فایل .env!');
    console.error('\x1b[31m%s\x1b[0m', ' برنامه برای اتصال به دیتابیس نیاز به تنظیمات دارد.');
    console.log('\n');
    console.log('\x1b[33m%s\x1b[0m', ' 🛠 راه حل برای لوکال (Local):');
    console.log('    - فایل .env.example را به .env تغییر نام دهید و مقادیر را پر کنید.');
    console.log('\n');
    console.log('\x1b[33m%s\x1b[0m', ' ☁️ راه حل برای سرور (Vercel/Netlify):');
    console.log('    - به پنل تنظیمات پروژه (Settings > Environment Variables) بروید.');
    console.log('    - متغیرهای VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را اضافه کنید.');
    console.log('\n');
    process.exit(1);
}
