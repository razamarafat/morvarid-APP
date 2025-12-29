
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if .env exists in the root directory (one level up from scripts)
const envPath = path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  console.log('\n');
  console.error('\x1b[41m\x1b[37m%s\x1b[0m', ' [CRITICAL ERROR] Missing Environment Configuration ');
  console.error('\x1b[31m%s\x1b[0m', ' --------------------------------------------------- ');
  console.error('\x1b[31m%s\x1b[0m', ' ❌ فایل .env در ریشه پروژه پیدا نشد!');
  console.error('\x1b[31m%s\x1b[0m', ' برنامه بدون تنظیمات محیطی قادر به اجرا نیست.');
  console.log('\n');
  console.log('\x1b[33m%s\x1b[0m', ' ✅ راه حل:');
  console.log('    1. از فایل .env.example یک کپی بگیرید.');
  console.log('    2. نام آن را به .env تغییر دهید.');
  console.log('    3. مقادیر VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را در آن وارد کنید.');
  console.log('\n');
  process.exit(1);
} else {
  console.log('\x1b[32m%s\x1b[0m', ' ✅ Environment configuration found. Starting app...');
}
