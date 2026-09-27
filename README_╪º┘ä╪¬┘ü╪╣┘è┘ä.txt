AmirCasher v1.2.0

إصلاح التفعيل:
- صفحة التفعيل تقرأ الحالة من Electron مباشرة.
- Machine ID يظهر بعد فتح صفحة التفعيل.
- النسخة التجريبية 15 يوم.
- بعد انتهاء التجربة يظهر مربع التفعيل ومعه Machine ID.
- كود التفعيل مرتبط بالجهاز.

تسجيل الدخول:
admin / admin

لتشغيل البرنامج:
npm install
npm start

لبناء ملف التسطيب:
شغّل build-installer.bat

لإصدار كود تفعيل:
شغّل توليد_كود_التفعيل.bat
أو:
node tools/create-license.js "اسم العميل" "MachineID" 365

مهم:
private-key.pem خاص بصاحب البرنامج فقط ولا يتم إعطاؤه للعميل. ملف التسطيب لا يضم private-key.pem.
