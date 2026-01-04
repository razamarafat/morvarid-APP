# راهنمای نصب سیستم Reset

## مرحله 1: نصب Database Functions

ابتدا فایل `database_reset_function.sql` را در Supabase SQL Editor اجرا کنید:

```sql
-- این فایل شامل:
-- ✅ تابع perform_system_reset
-- ✅ تابع verify_super_admin_access  
-- ✅ مجوزهای لازم
```

## مرحله 2: تست عملکرد

### تست اعتبارسنجی:
```sql
SELECT public.verify_super_admin_access('rezamarefat', '1385raza');
```

**نتیجه مورد انتظار:**
```json
{"success": true, "message": "دسترسی مدیر اصلی تایید شد", "timestamp": "..."}
```

### تست کامل (اختیاری - خطرناک!):
```sql
SELECT public.perform_system_reset('rezamarefat', '1385raza', 'RESET_COMPLETE_SYSTEM');
```

## مرحله 3: امنیت

### اطلاعات Super Admin (محرمانه):
- **نام کاربری:** `rezamarefat`
- **رمز عبور:** `1385raza`
- **متن تایید:** `RESET_COMPLETE_SYSTEM`

⚠️ **هشدار امنیتی:** این اطلاعات فقط برای شما است و نباید با کسی به اشتراک گذاشته شود.

## مرحله 4: عملکرد UI

### کارت Reset:
- فقط برای کاربران با نقش `ADMIN` نمایش داده می‌شود
- رنگ قرمز با انیمیشن pulse
- آیکون Trash2
- عنوان: "خام کردن کل برنامه"

### فرآیند تایید:
1. **هشدار اولیه** - توضیح خطرات
2. **اعتبارسنجی** - نام کاربری و رمز عبور super admin
3. **تایید نهایی** - تایپ عبارت `RESET_COMPLETE_SYSTEM`
4. **پردازش** - نمایش spinner
5. **تکمیل** - نمایش موفقیت و بازآوری خودکار

## مرحله 5: نتایج Reset

پس از اجرای موفق:
- تمام داده‌های کاربران حذف می‌شوند
- یک اکانت super admin جدید ایجاد می‌شود
- سیستم به حالت اولیه برمی‌گردد
- صفحه به طور خودکار reload می‌شود

## نکات مهم:

1. **فقط در محیط آزمایش** استفاده کنید
2. **هرگز در production** اجرا نکنید  
3. **قبل از reset** backup تهیه کنید
4. **اطلاعات super admin** را محفوظ نگهدارید