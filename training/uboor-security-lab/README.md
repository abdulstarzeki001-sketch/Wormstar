# UBOOR Security Lab — مختبر تدقيق محلي

> **Offline / Read-only / Synthetic by default.** مشروع تعليمي لتوثيق التجارب المنفذة في Kali على ملفات HAR وJavaScript واستجابات HTTP المحفوظة. **لا يرسل أي طلب إلى خادم UBOOR ولا ينشئ وثائق شحن أو يخصم أرصدة.**

## البداية السريعة على Kali Linux

```bash
cd Wormstar
bash scripts/run-uboor-lab.sh
```

لا تحتاج إلى `pip install` أو API keys: الأدوات تستخدم Python 3 (المكتبة القياسية)، SQLite وBash.

سيظهر في النهاية `ALL LOCAL LABS COMPLETED`. تقارير JSON تُكتب داخل مجلد `reports/` وتتجاهلها Git.

## هيكل المشروع

| المجلد/الملف | المحتوى |
|---|---|
| `scripts/uboor_har_analyzer.py` | محلل HAR الأصلي مع التنقيح |
| `scripts/har_forensic_lab.py` | تكرار الطلبات ومطابقة الوزن؛ يدعم `"1.9"` و`1.9` |
| `scripts/uboor_response_audit.py` | تحليل HTTP/JSON وQR شكليًا دون فك تشفير |
| `scripts/create_training_har.py` | توليد HAR اصطناعي بثلاثة طلبات |
| `scripts/js_static_audit.py` | فهرسة JS محليًا دون طباعة قيم الأسرار |
| `scripts/correlate_audit.py` | دمج ملخصات التقارير المنقحة |
| `labs/validate_weight_lab.py` | 8 اختبارات وحدات للتحقق من الأوزان |
| `labs/race_lab.py` | Lost Update مقابل معاملة SQLite ذرية |
| `labs/auth_header_lab.py` | محاكاة أولوية Authorization برموز وهمية |
| `samples/` | HAR وJSON وJS اصطناعية **فقط** |
| `tests/` | فحوص Python الآلية |
| `docs/` | مراجعة JS السابقة والمنهجية والقيود |
| `../../.github/workflows/uboor-offline-lab.yml` | تشغيل الاختبارات تلقائيًا عبر GitHub Actions |
| `private_inputs/` | للملفات الأصلية محليًا، **متجاهَل من Git** |
| `reports/` | مخرجات التحليل، **متجاهَلة من Git** |

## تشغيل كل تجربة على حدة

```bash
python3 labs/validate_weight_lab.py
python3 labs/auth_header_lab.py
python3 labs/race_lab.py

python3 scripts/uboor_har_analyzer.py samples/network.har \
  --out reports/legacy_har_report.json

python3 scripts/har_forensic_lab.py samples/har_training.har \
  --output reports/har_forensic_report.json

python3 scripts/uboor_response_audit.py samples/uboor_response_demo.json \
  -o reports/response_report.json

python3 scripts/js_static_audit.py --directory samples/js \
  --output reports/js_static_report.json

python3 scripts/correlate_audit.py
```


## ملاحظات النشر داخل Wormstar

هذا المختبر مدمج كحزمة مستقلة داخل `training/uboor-security-lab/`.
شغّله من جذر Wormstar بالأمر `bash scripts/run-uboor-lab.sh`.
ملفات التحليل الأصلية للجهات الخارجية غير موجودة هنا، ولا ينبغي إضافتها إلى مستودع Wormstar العام.
تتوفر تفاصيل إضافية في `docs/uboor-security-lab.md` عند جذر Wormstar.
