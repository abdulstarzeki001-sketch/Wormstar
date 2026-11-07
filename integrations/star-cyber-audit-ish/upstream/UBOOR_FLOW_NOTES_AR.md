# خريطة تدفقات واجهة UBOOR (تحليل تاريخي غير رسمي)

هذه النتائج من مراجعة ساكنة لأصول JavaScript كانت عامة أو محفوظة في 6–7 نوفمبر 2026.
المسارات نسبية ولا تعني أن الخادم يقبلها دون مصادقة أو أن التحقق الرسمي من صحة الوثيقة يجري في العميل.

| الوحدة | الوظيفة | مسار من الشيفرة |
|---|---|---|
| QRLocal | مسح وثيقة شركة | local_form/read_doc_company |
| QRImported | عرض قراءة المستورد | local_form/read_doc_company |
| QrLocalImporter / useExitGate | قراءة QR في بوابة الخروج | support_org/read_qr_exitgate |
| QrControlScan | سجل محلي | local_form/paginate_qrcode_reader2 |
| QRReadings | سجل قراءات آخر | local_form/pagination_qrcode_reader |
| QRHealthCertificate | قراءة شهادة صحية | BorderPort_HS/read_doc_health |
| DisableDocument | طلب إعادة ضبط QR | local_form/reset_company_qrcode |
| EntranceGateView | بحث الحمولة | carrier_register/scrape_search_goods_gateway_register |
| EntranceGateView | إرسال قرار المدخل | carrier_register/gateway_decision |
| AchievementDocument | استرجاع استمارة الناقل | support_org/return_doc_qrcode_export |
| QRCheckpoints | عرض read_doc | لا API مباشر |
| qrStore | تخزين qr_readings | localStorage |

## الملاحظات الفنية

- HuaweiCloudWAF قد يُرجع HTML بدل JavaScript مع حالة HTTP 200.
- تسجيل رمز Bearer ضمن console في بعض إصدارات الواجهة يحتاج حذفًا.
- بعض مسارات الخطأ تعيد تنفيذ POST للتشخيص وقد تؤدي إلى تكرار العمل.
- QR المولَّد محليًا من doc_id أو doc_number لا يعني توثيقًا رسميًا.
- حالات العرض البديلة في QRDocument/QRCheckpoints قد تعرض سياقًا قديمًا.
- بعض ملفات الطباعة قد تستدعي خدمة QR خارجية في حال فشل المولد المحلي.
- لم يتم اختبار صلاحيات الخادم أو استخراج مفاتيح أو إجراء أي طلبات تغيّر البيانات.

المشروع جهة مستقلة للتحليل التعليمي وليس جزءًا من منصة عبور.
