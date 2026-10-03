# Hesbah License Manager

أداة إدارية مستقلة لإصدار تراخيص Hesbah.

التشغيل من داخل مجلد license-manager:
npm.cmd install
npm.cmd start

في أول تشغيل:
1. اضغط استيراد private-key.pem.
2. اختر ملف private-key.pem الخاص بإنتاج تراخيص Hesbah.
3. البرنامج يتحقق أن المفتاح الخاص يطابق tools/public-key.pem المستخدم داخل Hesbah.
4. أدخل اسم العميل وMachine ID ومدة الترخيص.
5. اضغط إصدار كود التفعيل.
6. انسخ الكود وأرسله للعميل.

مهم: لا ترفع private-key.pem إلى GitHub ولا ترسله للعميل. أداة الإدارة تحفظ نسخة محلية في بياناتها.
