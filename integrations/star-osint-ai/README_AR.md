# STAR OSINT AI v2.0 — إصدار عملي محلي لكالي لينكس

> تنبيه: هذه أداة لإدارة أدلة OSINT العامة، وليست أداة اختراق أو إثبات تلقائي للثغرات. الذكاء المحلي مُساعد في الصياغة، وليس مصدراً بديلاً للأدلة. الواجهة مقيّدة بـ localhost.

**جديد:** لوحة `/insights`، تقدم المصدر لكل فحص، مقارنة الفحوص من المصادر الناجحة المشتركة، رصد SPF/DMARC/CAA، بحث محلي في جدول الأدلة، بصمة SHA-256، ونسخ احتياطي.

لترقية مستخدم v1.1 مباشرة راجع `UPDATE_V2_AR.txt`؛ لا تحذف `.env` أو `data`.

للتشخيص شغّل `./doctor.sh`، وللنسخ الاحتياطي `.venv/bin/python scripts/backup.py`.

---

# STAR OSINT AI — Kali Linux (Local Edition)

منصة عربية محلية لإدارة الاستطلاع مفتوح المصدر لأي نطاق DNS عام بالاعتماد على بيانات منشورة علناً، تحفظ الأدلة في SQLite وتعرض واجهة ويب وتصدر التقارير، مع تحليل استرشادي عبر Ollama داخل جهازك.

## الوظائف

- واجهة عربية RTL محسنة للموبايل والكمبيوتر، وتسجيل دخول واحد بكلمة مرور مخزنة عبر PBKDF2-SHA256.
- نطاق مشاريع Domains دون اشتراط ملكية النطاق للفحص السلبي، و5 مصادر: DNS، crt.sh، WHOIS، theHarvester (crtsh)، Amass passive (الاثنان الأخيران اختياريان).
- فحوص خلفية بعدد محدود، نتائج محفوظة مع وقت الجمع والمصدر والثقة.
- ملخص وتوصيات بالذكاء الاصطناعي عبر API محلي Ollama، مع ضوابط تخفيف Prompt Injection ومنع تنفيذ الأوامر.
- صفحة تقرير وخيار HTML للطباعة/الحفظ PDF من المتصفح؛ تنزيل Markdown، JSON، CSV (محمي من CSV formula injection).
- واجهة localhost افتراضياً، Cookies موقعة، CSRF، Rate limit لمحاولات الدخول، Security headers.

## متطلبات التشغيل

- Kali Linux حديث + اتصال بالشبكة لجمع الأدلة العامة. Python 3.10 أو أحدث، ذاكرة 8GB للواجهة و16GB مناسبة غالباً للنموذج 7B الكمّي (السرعة حسب المعالج/الذاكرة).
- Ollama اختياري لتشغيل التجميع والتقارير الأولية؛ ضروري **فقط** لتحليل AI.

## التثبيت على Kali Linux

```bash
unzip star-osint-ai.zip
cd star-osint-ai
chmod +x install_kali.sh start.sh
./install_kali.sh
```

ينفذ السكربت `apt install` لأدوات النظام، ينشئ `.venv` ويثبت الاعتمادات داخلها، ويسألك إنشاء اسم مستخدم وكلمة مرور 12 حرفاً على الأقل، ويولد `.env` سرياً بصلاحيات 600. لا تستخدم `sudo pip install`.

### تشغيل الذكاء الاصطناعي (Ollama)

ثبّت Ollama من المصدر الرسمي بعد مراجعته: https://ollama.com/download/linux

مثال التثبيت الرسمي من الموقع:

```bash
curl -fsSL https://ollama.com/install.sh -o /tmp/ollama-install.sh
less /tmp/ollama-install.sh  # راجع المحتوى أولاً
sh /tmp/ollama-install.sh
```

ثم:

```bash
ollama serve
```

وفي **طرفية ثانية**:

```bash
ollama pull qwen2.5:7b
```

لو كان جهازك بطيئاً، استعمل:

```bash
ollama pull qwen2.5:3b
sed -i 's/OLLAMA_MODEL=qwen2.5:7b/OLLAMA_MODEL=qwen2.5:3b/' .env
```

لا تعدّل عنوان API داخل الشيفرة لوجهة عامة دون قصد؛ ربط Ollama الافتراضي `127.0.0.1:11434` لا يتطلب مفتاح API ولا يجب نشره على الإنترنت. تحميل النموذج يتطلب اتصالاً بالشبكة مرة واحدة.

### بدء المنصة

```bash
./start.sh
```

ثم افتح:

`http://127.0.0.1:8787`

توقف بـ `Ctrl+C`. سيتطلب إعادة تشغيل السيرفر بعد تغيير `.env`.

## سير العمل

1. سجل الدخول باستخدام المعلومات التي أنشأتها عند التثبيت.
2. أضف أي نطاق DNS عام مثل `example.org` أو رابطاً كاملاً مثل `https://example.org/about`؛ تستخرج المنصة اسم النطاق فقط، ولا تحتاج لإثبات الملكية للفحص السلبي.
3. افتح المشروع، حدد أدوات الجمع، وابدأ الفحص.
4. بعد انتهاء الفحص، اطلع على الأدلة أو اختر **تحليل باستخدام Ollama**.
5. افتح التقرير. لتحويله إلى PDF نزّل HTML وافتحه بالمتصفح ثم `Ctrl+P` → `Save as PDF`.

## التحديث من الإصدار v1.0 إلى v1.1

لا تحذف ملفات `.env` أو مجلد `data/` لأنها تحتوي على حساب المدير وقاعدة البيانات. أوقف السيرفر `Ctrl+C`، ثم استخرج ZIP الجديد فوق مجلد `star-osint-ai` الحالي باستخدام `unzip -o`، ثم نفذ `.venv/bin/python -m pytest -q` و `./start.sh`. لا تحتاج لإعادة إنشاء حساب المدير أو إعادة تثبيت Ollama.

- v1.1 يقبل أي نطاق عام، ونطاقات Unicode الدولية، و`*.example.org`، وروابط HTTP/HTTPS مع المسار والمنفذ والمعلمات؛ ويحوّلها إلى اسم مضيف موحّد.
- لا يشمل إدخال عنوان IP مباشرة أو أسماء `localhost` أو الشبكات الداخلية أو نطاقات DNS المحلية.
- لا تتصل أدوات الجمع بالموقع عبر المسار المُدخل؛ الاستعلام يكون عن اسم النطاق فقط باستخدام الأدوات السلبية.
- الاستطلاع من المصادر العامة لا يعني الإذن باختبارات اختراق أو مسح نشط؛ احصل على التفويض لأي اختبار يتجاوز جمع المعلومات العامة.

## تنبيهات مهمة

- ليست ماسح ثغرات ولا نظام مراقبة حسابات شخصية. النتائج من المصادر العامة ولا تثبت وجود ثغرة بمفردها.
- جمع OSINT نفسه يرسل طلبات إلى DNS / crt.sh / WHOIS / موفري بيانات theHarvester وAmass؛ **الذكاء الاصطناعي محلي فقط**.
- CT قد يفشل أو يحظر بعض الطلبات وقد تكون بعض النتائج قديمة. فشل أداة لا يعني غياب بيانات.
- عند غياب Ollama، تظل كل النتائج والتقارير الخام متاحة؛ التحليل الآلي يظهر رسالة فشل واضحة، وليس ملخصاً مخترعاً.
- الواجهة مخصصة لجهاز واحد على `127.0.0.1`. للربط البعيد يلزم HTTPS، reverse proxy، إدارة جلسات ومستخدمين، IAM، تحصين أقوى وقيود شبكية؛ لا تحول `--host` إلى `0.0.0.0` مباشرةً.
- لا تحفظ معلومات شخصية أو أسرار داخل حقول النطاق. قاعدة البيانات و`.env` ملفات خاصة يجب حمايتها.
- ما من صلاحية Docker أو root مطلوبة لتشغيل السيرفر؛ يستخدم `sudo` فقط لتثبيت حزم النظام.

## اختبارات محلية بدون شبكة

```bash
.venv/bin/python -m pytest -q
```

## هيكل المشروع

```text
star-osint-ai/
├── app/
│   ├── main.py          # FastAPI web + session auth + routes
│   ├── collectors.py    # passive DNS / CT / WHOIS / theHarvester / Amass
│   ├── ai.py            # Ollama local chat API
│   ├── db.py            # SQLite schema + audit
│   ├── reports.py       # HTML/MD/JSON/CSV
│   ├── security.py      # Password hashing / login throttling
│   ├── templates/       # RTL Jinja pages
│   └── static/          # UI CSS and polling JS
├── scripts/create_admin.py
├── tests/
├── install_kali.sh
├── start.sh
├── requirements.txt
└── .env.example
```

## فحص المتاعب الشائعة

- `externally-managed-environment`: استخدم `.venv/bin/python -m pip install -r requirements.txt` بدلاً من pip على نظام Kali.
- `Missing .env credentials`: شغّل `.venv/bin/python scripts/create_admin.py` مرة واحدة.
- `Ollama OFFLINE`: تأكد من `ollama serve` ثم جرّب `curl http://127.0.0.1:11434/api/tags`.
- `MODEL NOT FOUND`: تحقق من `ollama list` ومن تطابق اسم النموذج مع قيمة `OLLAMA_MODEL` في `.env`.
- `theHarvester` أو `amass` معطل: تأكد من `command -v theHarvester` أو `command -v amass`.
- `Connection refused` في الواجهة: تأكد أن `./start.sh` لا يزال يعمل وأن المنفذ 8787 غير مستخدم.
- Windows/WSL: افتح العنوان في المتصفح؛ الوصول من جهاز آخر غير مُفعل لأسباب أمنية.

## حدود الإصدار

هذا إصدار محلي single-user. المهام تعمل في ThreadPool داخل العملية وتفشل بوضوح عند إعادة تشغيل الخدمة؛ لا يدعم الجدولة الدائمة أو حسابات فرق العمل أو محرك بحث كامل أو توليد PDF خادمي. **PDF عبر الطباعة من HTML** وليس مكتبة PDF على الخادم.
