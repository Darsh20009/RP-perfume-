# القائمة المرجعية للنشر على Render (Render Deployment Checklist)

لضمان نجاح النشر وحل المشاكل التقنية التي واجهتها، يرجى اتباع الإعدادات التالية في لوحة تحكم Render:

## 1. إعدادات البناء والتشغيل (Build & Start Settings)
- [ ] **Build Command**: `npm run build`
- [ ] **Start Command**: `npm run start`

## 2. متغيرات البيئة (Environment Variables)
يجب إضافة المتغيرات التالية بدقة:
- [ ] `MONGODB_URI`: رابط الاتصال بقاعدة بيانات MongoDB Atlas.
- [ ] `SESSION_SECRET`: نص عشوائي قوي لتشفير الجلسات (مثال: `your-secret-key-123`).
- [ ] `NODE_ENV`: قم بضبط القيمة على `production`.
- [ ] `PORT`: قم بضبط القيمة على `5000` (أو اترك Render يتعامل معها تلقائياً).

## 3. إعدادات قاعدة البيانات (MongoDB Atlas)
- [ ] تأكد من إضافة عنوان IP الخاص بـ Render إلى "Network Access" في MongoDB Atlas، أو السماح بجميع العناوين مؤقتاً (`0.0.0.0/0`) للتأكد من الاتصال.

## 4. إصلاحات برمجية تم تنفيذها (Already Fixed)
- [x] تم تحديث ملف `script/build.ts` لتضمين مكتبة `mongoose` في ملف الإنتاج النهائي.
- [x] تم تعطيل "Minify" مؤقتاً في ملف البناء لتجنب تعارض الأسماء في مكتبات Mongoose و Passport التي تسببت في فشل التشغيل.
- [x] تم إعداد نظام PWA بشعار واضح لدعم التثبيت كـ "تطبيق" على جميع الأجهزة.

## 5. خطوات التأكد من النجاح
- [ ] بعد حفظ الإعدادات، راقب "Deploy Logs" في Render.
- [ ] إذا ظهرت رسالة `serving on port 5000` و `Connected to MongoDB` فهذا يعني أن الموقع يعمل بنجاح.
