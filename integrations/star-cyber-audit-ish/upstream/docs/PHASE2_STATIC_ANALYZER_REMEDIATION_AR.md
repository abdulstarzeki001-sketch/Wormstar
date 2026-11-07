# المرحلة الثانية — إصلاح محلل Star Cyber Audit والتحقق الآلي

**التاريخ:** 7 نوفمبر 2026  
**المشروع:** [Star-Cyber-Audit-iSH](https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH)  
**الحالة:** تم رفع الإصلاحات إلى main والتحقق من نجاح الاختبارات. الفحوص محلية ولا تتصل بأنظمة UBOOR أو DMS.

## الإصلاحات المنفذة

- **تصنيف الملفات:** التعرف على مقاطع Webpack المصغرة التي تحمل `webpackChunkDMS`، إلى جانب ESM وVite. رفض صفحات HTML وتحديات WAF وJSON والمحتوى الثنائي وصفحات الحظر النصية حتى لو انتهت بـ `.js`.
- **اكتشاف API:** إدراج المسار `/api/verify/` واستدعاء XHR في ملفات DMS، إضافة إلى مسارات UBOOR السابقة.
- **التغطية:** `--local` يمر على المجلدات الفرعية، يتجنب `.git` و`node_modules` والمجلدات المؤقتة، ولا يتبع الروابط الرمزية، مع حد أقصى للملفات.
- **الأسماء المكررة:** يعتمد المفتاح على `relative_path` فلا يدمج ملفين مختلفين لهما الاسم نفسه.
- **التقارير:** عرض المسار النسبي في مخرجات CSV وHTML وJSON، مع تهريب HTML والقيم التي قد تُعامل كصيغ CSV.

## اختبارات CI

أُضيفت 12 حالة اختبار تراجع إلى 3 حالات سابقة، بالإضافة إلى فحص كامل للأرشيف باستخدام:

~~~sh
python3 -m unittest discover -s tests -v
python3 analyze.py --local .
~~~

اختبار GitHub Actions يفحص فعليًا الشيفرة المؤرشفة ويؤكد وجود المسارات التالية في النتائج:

- `/api/verify/` من `6439.3d46893d(1).js`
- `local_form/read_doc_company` من `QRLocal-5TAaXbzM.js`
- `local_form/refuse_doc_company` من `QRDocument-BJwpoEJY.js`

تم التحقق من نجاح التشغيل: [نتيجة GitHub Actions](https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH/actions/runs/42384263612).

## التشغيل على iSH أو Kali أو WSL

~~~sh
git clone https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH.git
cd Star-Cyber-Audit-iSH
sh run.sh --local .
~~~

ستُنتج الملفات داخل `reports/`، ومنها `analysis.json` و`report.html` و`api_paths.txt` و`inventory.csv`.

## حدود العمل

لم تُعدّل مصادر UBOOR أو DMS الحكومية المؤرشفة، ولم تُختبر صلاحيات الخوادم أو صحة أي وثيقة. الإصلاحات تخص `analyze.py` واختبارات المشروع فقط. ملاحظات Console وتكرار POST وعزل جلسات الموظف وصاحب الشركة ما زالت بحاجة لإصلاح في المشروع الأصلي من فريق يملك صلاحية تعديله. المستودع **عام** ويتضمن نسخًا من بعض أصول الطرف الثالث تم رفعها سابقًا؛ لا تنشر أسرار جلسات أو بيانات شخصية.

لم يُغيَّر موقع Cloudflare في هذه المرحلة.
