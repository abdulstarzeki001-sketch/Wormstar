# سجل الذاكرة المستعاد — QR / UBOOR / UR / DMS

**جمع واسترجاع:** 8 نوفمبر 2026  
**النطاق المقصود حصراً:** رموز QR، بوابة عبور `customs-uboor.ur.gov.iq`، نظام أور `ur.gov.iq` و`dm.ur.gov.iq`، تكامل الوثائق وPDF، ومشروع التدقيق `Star-Cyber-Audit-iSH`.  
**المصادر:** ملخصات محادثات سابقة متاحة، الملفات المرفوعة في المحادثة، التقرير الموحد `UBOOR_FULL_CROSS_FILE_REVIEW_2026-11-08_AR.md`، وتوثيق وتقارير GitHub في `abdulstarzeki001-sketch/Star-Cyber-Audit-iSH`.  
**الموثوقية:** هذا إعادة تركيب لأعمال متعددة، **لا يعادل نصًا حرفيًا كاملًا لكل محادثة**. حيث لا يوجد مصدر أو تأكيد نشر/تنفيذ، وُسم النشاط بأنه «مقترح/تجريبي/غير مثبت».

---

## 1. أهدافنا الثابتة خلال المحادثات

- فهم وثائق عبور الخاصة بالمحلي والمستورد والشحنات والشهادات الصحية، وربط صفحة الشركة والمادة والمركبة والسائق والسيطرة ومخرجات الوثيقة المؤقتة والنهائية.
- معرفة تدفق QR: ما النص داخل الرمز؟ كيف يُحوّل إلى رابط `robot?url=`؟ ما علاقة `local_company`؟ كيف يقرأه نظام أور `ReadQrWithUR` و`qrpubliclink`؟ وكيف يصل إلى عرض PDF؟
- قراءة شيفرة الواجهة (Vue/Vite وDMS/Webpack) وتحويل أجزاء متفرقة إلى خريطة APIs وتدفقات وثائق ومصادقة وأماكن خلل واجهة مؤكدة.
- بناء **نماذج تدريبية ومختبر تحليل غير رسمي**، خاصة على iSH/iPhone وWindows/Kali، للتدقيق الساكن والاختبارات الاصطناعية؛ وليس إصدار وثائق رسمية أو تجاوز مصادقة المنصة الحكومية.
- المحافظة على المخرجات والتوثيق في GitHub مع توضيح ما هو مؤكد من Frontend وما يتطلب إذنًا ومصدرًا من Backend.

## 2. التسلسل الزمني المستعاد

### يناير 2026 — واجهة عبور وأصول موقع الشركة

- استكشاف `customs-uboor.ur.gov.iq` وحفظ نسخة من صفحة صاحب الشركة وملفات HTML/JS/CSS/خطوط؛ ورد في محادثة سابقة تنزيل نحو 20 ملفًا مع عدم وجود أخطاء تنزيل.
- تحديد أنها SPA مبنية على Vue/Vite، وأن HTML وحده لا يجلب بيانات الشركة؛ المسارات الحقيقية تظهر في JavaScript وXHR.
- شرح تشغيل نسخة محلية على `localhost` عبر خادم static، مع التحذير أن 401/CORS/مصادقة الخادم قد يمنع اكتمال الوظائف.
- عدم إثبات أن النسخة المحلية أصبحت بوابة مرتبطة بالحسابات الحكومية.

### فبراير 2026 — صاحب الشركة والشحن وQR القابل للتكامل

- تحليل مراحل `CompanyOwnerView`: دخول عبر بوابة أور أو phone/code، البحث بالكود (`company_hash_code`)، بيانات المالك والإجازة والمواد والطاقة الإنتاجية، طلب تخفيض كميات، وإعادة توليد الوثيقة.
- دراسة التدفق `CompanyOwnerItems → companyItemsReduce → API → ShipmentDoc`، مع مسارات `search_iraqi_company`, `get_company_items/{hash}`, `company_item_reduce`, `return_company_doc/{hash}`.
- اكتشاف اسم المفتاح `vihcle_info` في جسم الشحنة، ووصف حقول `item1`, `item2`، GPS، السائق والعجلة والوجهة والسيطرة.
- اقتراح نماذج Node/Express وPostgreSQL وJWT وHMAC-SHA256 وFernet لتطبيق **مستقل ومملوك** يولد QR ويثبت أصالة سجلاته ويمنع التكرار؛ هذه أفكار/قوالب لا دليل على نشرها كتطبيق رسمي.
- دراسة رسم QR من `qr_code`/Base64/الرابط باستخدام مكتبات محلية، وQuickChart كخدمة خارجية مع خطر كشف محتوى QR.

### مارس 2026 — مسارات UR، رموز Fernet، ملفات النماذج

- قراءة حزم DMS/Webpack وتحديد المسارين `/ReadQrWithUR` و`/qrpubliclink/:qrcode?` ومسار التحقق المرصود `GET /api/verify/{code}`. ظهرت أيضًا روابط `ReadQrWithUR?code=def50200...`؛ **لا يوجد دليل بأن سلسلة `def50200...` هي نفس تنسيق رمز `gAAAAA...|local_company`**، ولا يُستنتج مفتاح أو خوارزمية موحدة منهما.
- إرسال/تحليل رابط عبور بالنمط `https://customs-uboor.ur.gov.iq/robot?url=<TOKEN>|local_company`؛ تفسير بنية `gAAAAA...` على أنها متوافقة مع Fernet، لا إثبات لطريقة الخادم الداخلية.
- النقاش حول نماذج frontend/backend مستقلة (منها أرشيف scaffold `dms_project_system.zip` الذي ذُكر في محادثة سابقة) وطرق عرض JSON/PDF. لا يوجد دليل مكتمل على نشره أو مطابقته للتحقق الحكومي.
- تحليل `company_item_reduce` كـPUT بجسم JSON لسلع `hash_id` وكميات ومعلومات مركبة؛ استخراج عقود الواجهة من الطلب، وعدم حسم تحقق ملكية السلع في الخادم.
- مناقشة رموز بحث الشركات القصيرة واحتمالات SHA/HMAC؛ لم تُستنتج خوارزمية رسمية ولم يتم امتلاك مفتاح حكومي.
- رصد استجابة Proof-of-Work للحماية في أحد المسارات، مع غياب نتيجة مثبتة لاستكمال التحقق؛ معاملة WAF والحماية كطبقات مختلفة عن مفتاح QR.

### أبريل–مايو 2026 — معاينات وثائق وروابط QR

- مقارنة رمز يبدأ `gAAAAA` ورابط `robot?url` بمخرجات صفحة وثيقة جمركية؛ التمييز بين URL يعرض وثيقة وبين توقيع رسمي موثوق.
- مناقشة QR ثابت ودائم يربط PDF يملكه المستخدم، أو نموذج تحقق خاص به؛ وهذه أفكار لا تعني إصدارًا حكوميًا.
- العمل على تصاميم/قوالب نماذج A4 تدريبية، ونسخ Python/Flask/SQLite أو Node/Express لحفظ المعاينات وتصدير PDF/CSV وسجل عمليات محلي؛ لا تُنسب لهذه النماذج صلاحية حكومية. تضمنت أفكار النماذج جلسات، لوحة إدارة، رفع PDF، تسجيل أحداث، وإعادة توجيه إلى صفحة تحقق محلية. ذُكرت تجارب نشر (مثل Docker/Nginx/Render) مع مشاكل بناء SPA؛ **لا أملك في سجل استرجاع هذه المحادثة دليلاً على نشر نسخة عاملة ومستقلة بصورة نهائية**.

### أكتوبر 2026 — توسيع تحليل UR/UBOOR

- مراجعة ملفات `1997`, `2752`, `6439`, `978`, `index.801a60b0`, وملفات `ReadQrWithUR?code=...`، وتمييز Webpack/DMS عن واجهة UBOOR/Vite.
- تحليل حالة `Valid`: منطق مكوّن DMS المرصود قد يكتفي بوجود `document` في JSON قبل عرض Valid؛ لا يثبت صلاحية الرمز عند الخادم.
- فصل الردود الناجحة/JSON/PDF عن صفحات WAF HTML والتحديات الأمنية، من دون تجاوز طبقة الحماية.

### 6–8 نوفمبر 2026 — مشروع التدقيق وأرشيف النتائج

- بناء/توسيع مشروع `Star-Cyber-Audit-iSH` على GitHub لتجميع **تقارير** عربية ومحللات Python تعمل دون شبكة واختبارات `unittest`، واستخدام iSH على iPhone.
- نتائج تشغيل iSH الأولى: **10/10 ملفات** مفحوصة، **33 مسار API مميزًا** ضمن تلك المجموعة، و**15 إشارة مراجعة آلية**. هذه ليست أعدادًا عالمية لكل المنصة ولا 15 ثغرة مؤكدة.
- تحليل ملفات `QRLocal`, `QRImported`, `QrLocalImporter`, `QrControlScan`, `QRReadings`, `QRDocument`, `qrStore`, `QRCheckpoints`, `RejectedLocalDocuments`, `DisableDocument`, `QRHealthCertificate`, `PrintHealthCertificateView`, `useLocalCompany`, `useHealthCertificate`, `useExitGate`, `AchievementDocument`, `CompanyOwnerView`, و`index-gleMzSil`؛ بالإضافة لتقارير سابقة عن DMS/employee و`ShipmentDoc`.
- حفظ تقارير كل ملف في `reviews/2026-11-08/`، وأدوات فحص مصدرية في `tools/ish/` واختبارات في `tests/`، مع إسناد نجاح CI إلى **اختبارات مشروع التدقيق فقط**.
- الملفان `QRLocal-5TAaXbzM(3).js` و`QRImported-C65Oqm1K 2.js` والمرفقات المتكررة `QRDocument` و`qrStore` طابقت النسخ التي جرى فحصها قبلها؛ لم تعتبر إصدارات جديدة.
- فحص PDF `وثيقة-549976.pdf` وصور شاشة الهاتف: نص QR في PDF هو `<Fernet-like token>|local_company`، وفي صورة الهاتف **URL من `/robot?url=` يحمل الرمز نفسه**؛ رأس الرمز يتوافق زمنيًا مع 15 أكتوبر 2026 15:54:01 بغداد. هذه مقارنة بنيوية/بصرية لا تحقق توقيع. لوحظ عدم تطابق بعض الحقول الظاهرة بين صورة الهاتف وPDF، مثل الوقت ومحافظة تسجيل المركبة، ولم يُثبت السبب.

## 3. الأنظمة الثلاثة منفصلة لكن مترابطة وظيفيًا

### A. UBOOR Customs

- المضيف: `customs-uboor.ur.gov.iq`.
- بناء Vite/Vue/Pinia/Axios؛ في حزمة مفحوصة: `baseURL=https://customs-uboor.ur.gov.iq/api/`.
- مجموعات API: `local_form`, `BorderPort_HS`, `support_org`, `carrier_register` وغيرها.
- مكوّنات الشركة: `CompanyOwnerView`, `CompanyOwnerItems`, `ShipmentDoc`؛ وقراءات المحلي والمستورد والشهادات والبوابات.

### B. UR / DMS

- مضيفون/مسارات: `dm.ur.gov.iq`, `ur.gov.iq/verify-auth`, `/ReadQrWithUR`, `/qrpubliclink/:qrcode?`.
- حزمة Webpack مختلفة، ومنها مسار `GET /api/verify/{code}` مع عرض `Valid` في الواجهة.
- `client_id=202` في DMS و`client_id=261` في واجهة صاحب الشركة ظاهران كنقطتي تكامل مختلفتين، وليسا سرين أو بالضرورة تطبيقًا واحدًا.

### C. مختبرنا

- مشروع GitHub: `https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH`.
- هدفه **فحص ملفات محلية** وإنتاج تقارير ومؤشرات مراجعة واختبارات؛ لا يتصل بالمنصة الحكومية أثناء التحليل ولا يصدر مستندات رسمية.
- مشاريع QR/Flask/Node/A4/PDF السابقة كانت نماذج تدريبية/تصاميم أو حزم تجريبية في محادثات متفرقة. لا يوجد دليل جامع على نشر خدمة تحقق مستقلة ذات اعتماد رسمي.

## 4. مسارات API المهمة من الواجهة (غير مختبرة خادميًا)

| الفئة | الطريقة | المسار | وصف |
|---|---|---|---|
| المحلي | POST | `local_form/read_doc_company` | قراءة QR بيانات شركة |
| المحلي | POST | `local_form/return_doc_qrcode` | جلب معاينة وثيقة |
| المحلي | POST | `local_form/refuse_doc_company` | إرسال طلب رفض مع سبب وموقع |
| المحلي | POST | `local_form/reset_company_qrcode` | إعادة ضبط/تعطيل وفق تسمية API |
| المحلي | POST | `local_form/pagination_qrcode_reader` | سجل قراءات محلي من شاشة QRReadings |
| المحلي | POST | `local_form/paginate_qrcode_reader2` | سجل قراءات من useLocalCompany |
| المحلي | POST | `local_form/pagination_rejected_qrcode_reader` | سجل المحلي المرفوض |
| صاحب الشركة | POST | `local_form/company_verify_login` | بدء تسجيل الدخول |
| صاحب الشركة | POST | `local_form/company_verification` | التحقق بالكود |
| صاحب الشركة | POST | `local_form/search_iraqi_company` | بحث الشركة |
| صاحب الشركة | GET | `local_form/get_company_items/{hash}` | بيانات عناصر الشركة |
| صاحب الشركة | PUT | `local_form/company_item_reduce` | تخفيض كميات/طلب شحن |
| صاحب الشركة | POST | `local_form/return_company_doc/{hash}` | إعادة توليد وثيقة |
| مستورد/بوابة | POST | `support_org/read_qr_exitgate` | قراءة QR لدى الخروج |
| مستورد/بوابة | POST | `support_org/return_doc_qrcode_export` | استرجاع وثيقة ناقل |
| مستورد/بوابة | POST | `support_org/paginate_qrcode_reader_import` | قائمة قراءات المستورد |
| الشهادة | POST | `BorderPort_HS/read_doc_health` | قراءة QR صحي |
| الشهادة | POST | `BorderPort_HS/return_doc_hc_by_docnumber` | استرجاع شهادة برقم |
| الوثائق | POST | `BorderPort_HS/path-document-file` | رفع صورة مستند من الواجهة بشروط |
| البوابة | POST | `carrier_register/scrape_search_goods_gateway_register` | البحث عن حمولة مسجلة |
| البوابة | POST | `carrier_register/gateway_decision` | إرسال قرار بوابة |
| DMS/UR | GET | `/api/verify/{code}` | التحقق/العرض وفق واجهة DMS |

الجدول يجمع أمثلة أساسية من إصدارات **غير متزامنة**، وليس وثيقة OpenAPI رسمية. تشابه المسارات لا يعني وحدة الأدوار أو شروط النجاح.

## 5. البيانات ومفاتيح التخزين التي تتبعتها

- `localStorage['qr_readings']` — مصدر `qrStore`، يحفظ سجلات معاينات QR، ويضيف الجديد في المقدمة، ولا يوجد في الوحدة حد/TTL أو عزل حساب؛ لا يعادل سجل الحكومة.
- `sessionStorage['qr_read_doc']` — قراءات سيطرات مؤقتة؛ `QRDocument` يكتبه و`QRCheckpoints` قد يقرأه عند غياب `props.items`.
- `sessionStorage['qr_preview_entry']` — معاينة وثيقة مرسلة من قوائم القراءات إلى `QRDocument`.
- `sessionStorage['hc_print']` — بيانات عرض/طباعة الشهادة الصحية التي ينقلها قارئ `QRHealthCertificate` إلى صفحة الطباعة.
- `sessionStorage['hc_detail']` — بيانات تفاصيل قد يمزجها عرض الشهادة الصحية مع `hc_print`.
- `localStorage['company_owner_token']` و`is_authenticated_owner` — حالة دخول صاحب الشركة في واجهة المتصفح؛ ليست إثبات تفويض في الخادم.

## 6. أبرز المشكلات المثبتة في واجهة العميل

1. `QRLocal` و`QRImported` يطبعان Bearer والطلب في Console، ما يعرض معلومات جلسة أمام من يمكنه الوصول إلى السجلات.
2. `QRLocal`, `QRImported`, `DisableDocument` قد يعيدون إرسال POST ثانٍ للتشخيص عند استثناء؛ أثر التكرار على Backend لم يُختبر.
3. `QRDocument` يستخدم اختيارًا احتياطيًا `a.value=AA||x[0]||null` عند عدم وجود ID مطابق، وقد يُظهر مستندًا آخر.
4. اعتراض Axios المشترك قد يكتب توكن الموظف على ترويسة صاحب الشركة، و401 قد ينهي كلا الجلستين.
5. مسار `auto_send` ينشئ لقطة PNG ويرفعها عند تحقق علم من بيانات العرض؛ يحتاج قواعد خادمية وعزلًا ووضوحًا للهوية والإذن.
6. `qrStore` يبتلع بعض أخطاء JSON/localStorage، لا يحدد عمر البيانات، ويقبل بنية غير مصفوفة.
7. `QRCheckpoints` يعرض `props.items` أو بيانات احتياطية من History/Session/URL، دون ربط ID واضح في fallback، ورابط Google Maps يعامل الحقول X/Y بتناقض.
8. `QRLocal` يرسل GPS؛ `QRImported` يرسل **موقع الرمز داخل صورة الكاميرا** ضمن أسماء الحقول نفسها `x_coordinate,y_coordinate`، ما يستدعي توثيق عقد كل API.
9. صلاحية 48 ساعة في بعض القارئات مشروطة بنص الرسالة/التاريخ؛ صفحة طباعة صحية قد تعرض ثلاثة أيام افتراضيًا. لا يثبت أي منهما مدة قانونية.
10. `CompanyOwnerView` يحتوي انتظار مصادقة غير منضبط، وتوجيهًا داخل `finally` مع phone في Query، ويجمع كميات منتجات في الواجهة.
11. DMS `6439.*` قد يعرض `Valid` لمجرد وجود `document` في JSON؛ ليس تقرير تحقق خادمي.
12. `AchievementDocument` و`ShipmentDoc` قد يرسمان صورة QR من قيمة نصية بديلة؛ والمساعدات الخارجية مثل QuickChart قد تتلقى النص عند طلب fallback.
13. ملف DMS للموظفين قد يُظهر `userRedirect`/`passRedirect` في Console أو رابط خارجي، دون إثبات ماهية القيم أو وصول طرف آخر.
14. أحد أصول DMS يستخدم Vue 2 المنتهي الدعم؛ هذا خطر تحديث وصيانة، وليس إثبات CVE قابل للاستغلال.

**أهم قيد:** هذه أخطاء واجهة ومخاطر هندسية محتملة؛ لا يوجد إثبات لتزوير مستند رسمي أو تجاوز RBAC أو فك مفتاح Fernet الحكومي.

## 7. ما أُنجز فعليًا مقابل ما بقي تخطيطًا

| العمل | الحالة المثبتة |
|---|---|
| تحليل ملفات JS وربط مسارات API | أُنجز على نطاق واسع، مع تقارير تفصيلية |
| تحليل iSH الأول | أُنجز: 10/10 ملفات، 33 API، 15 إشارة |
| إنشاء أدوات Python واختبارات unittest في GitHub | أُنجز؛ اختبارات CI ناجحة للـcommit الأخير الذي راجعناه |
| مقارنة QR داخل PDF وصور الهاتف | أُنجز محليًا؛ توافق الرمز ولم تتحقق أصالته الخادمية |
| تحديد بنية Fernet وتوقيته | تحقق بنيوي فقط، دون فك الرسالة أو فحص HMAC |
| تصميم نماذج Flask/SQLite وNode/Express وQR/PDF | ذُكرت نماذج/حزم/أمثلة؛ لا يوجد إثبات نشر كامل أو توافق حكومي |
| نشر نظام يقرأ ويفك QR حكوميًا دون المفتاح | **غير مثبت، ولا تملكه الواجهة** |
| اختبار قبول/رفض أو صلاحيات خادم عبور | **لم يتم في التدقيق الآمن** |
| الاطلاع على شيفرة التوقيع والتحقق لدى Backend | **غير متاح** |
| ربط جميع إصدارات واجهات DMS وUBOOR في Build موحد | غير صحيح؛ هذه إصدارات وأطر مختلفة |

## 8. الروابط المرجعية المثبتة

- مستودع التدقيق: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH
- التقرير الشامل القديم: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/blob/main/reviews/2026-11-07/FULL_STATIC_SECURITY_AUDIT_V2_AR.md
- جرد جميع المرفقات التاريخي: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/blob/main/research/ALL_FILES_INVENTORY_2026-11-07_AR.md
- تقرير QRDocument: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/blob/main/reviews/2026-11-08/QRDocument_deep_review_AR.md
- تقرير CompanyOwnerView: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/blob/main/reviews/2026-11-08/CompanyOwnerView_deep_review_AR.md
- تقرير DMS والموظفين: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/blob/main/reviews/2026-11-08/dms-employee-assets/DETAILED_STATIC_AUDIT_AR.md
- التقرير الموحد بتاريخ 8 نوفمبر: `UBOOR_FULL_CROSS_FILE_REVIEW_2026-11-08_AR.md` (ملف المحادثة، وليس بالضرورة في GitHub).
- آخر GitHub Actions تحقق منه السجل: https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/actions/runs/42458377576 ، Commit `fdc54f823346fef4130d79d419117f81ddffc49c`، النتيجة `success` لأدوات التدقيق.

## 9. أولويات متابعة لا تتطلب طلبات حكومية

- إنشاء نموذج اصطناعي لاختيار الوثيقة بالمعرّف الصحيح؛ رفض fallback إلى أحدث سجل عند ID غير موجود.
- ضمان عدم تسجيل التوكنات أو QR الحساسة في Console، وعدم إعادة إرسال POST داخل معالج الأخطاء.
- فصل جلسات صاحب الشركة والموظف وعزل مخزن `qr_readings` حسب الحساب وتحديد TTL.
- وضع طبقة توصيف بين أنواع الإحداثيات: GPS للجهاز مقابل Pixel Position للكاميرا.
- استخدام مخطط استجابة موحد وحقول `verified`, `status`, `expires_at` من خادم تجريبي مملوك، لا من نص رسالة أو شكل QR.
- تحديث التوثيق ليقارن بين إصدارات الحزم وفق SHA-256، بدل دمج Build DMS مع Build UBOOR تلقائيًا.

---

**بيان خصوصية:** هذا الملف لا يتضمن رموز QR الحقيقية أو توكنات جلسات، أو أرقام هواتف أصحاب الشركات أو بيانات سائقين/مركبات؛ لا ينبغي نشر هذه القيم في مستودع عام.

**بيان دقة الذاكرة:** استرجعت المعلومات المتاحة من السياق والمصادر والملفات. لا أدعي استعادة المحادثات المحذوفة حرفيًا أو امتلاك مفاتيح منصة عبور أو وصول خادمي غير موجود.