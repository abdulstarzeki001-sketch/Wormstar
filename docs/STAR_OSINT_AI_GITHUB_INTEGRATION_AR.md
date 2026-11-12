# ربط STAR OSINT AI v2.0 مع Wormstar

هذه الإضافة تشغّل STAR OSINT AI كوحدة مستقلة على Kali Linux. لا تنشر Ollama أو الواجهة المحلية على Cloudflare، ولا ترسل قواعد SQLite أو تقارير الفحص إلى GitHub.

## هيكل التكامل

- المصدر على Kali: ~/star-osint-v2/star-osint-ai
- الوجهة في Wormstar: integrations/star-osint-ai/
- GitHub Actions: اختبارات pytest بدون استدعاء Ollama أو جمع بيانات حقيقي
- تبقى Cloudflare Core وSentinel وiSH كما هي

## استيراد الكود من Kali

افتح Terminal في Kali:

~~~bash
sudo apt update
sudo apt install -y git gh rsync
gh auth login
gh auth setup-git

git clone --branch feature/star-osint-ai-v2-20261112 \
  https://github.com/abdulstarzeki001-sketch/Wormstar.git \
  "$HOME/Wormstar-OSINT"

cd "$HOME/Wormstar-OSINT"
bash scripts/import-star-osint-ai.sh

git status --short
git diff --cached --check
git commit -m "feat(osint): integrate local STAR OSINT AI v2"
git push -u origin feature/star-osint-ai-v2-20261112
~~~

قبل commit افحص أسماء الملفات المعروضة ولا تنشر .env أو data/ أو reports/ أو ملفات النماذج.

## تشغيل الوحدة

~~~bash
cd "$HOME/star-osint-v2/star-osint-ai"
./doctor.sh
./start.sh
~~~

افتح http://127.0.0.1:8787 من الجهاز نفسه، مع Ollama على 127.0.0.1:11434.

## GitHub Actions

سيعمل ملف .github/workflows/star-osint-ai.yml تلقائياً عند رفع الوحدة. الفحص يثبت المتطلبات ويشغّل اختبارات Python ويتحقق من عدم إدراج ملفات تشغيل حساسة.

## حدود التكامل

هذا تكامل مصدر/CI وليس ربطاً مباشراً بين خدمة Wormstar السحابية وOllama المحلي. الربط البعيد يتطلب موافقة منفصلة، هوية وصلاحيات، وتشفيراً مناسباً؛ لا تفتح المنفذ 11434 للإنترنت.


## التكامل داخل واجهة Wormstar Sentinel (على هذا الفرع)

تمت إضافة قسم **مختبر STAR OSINT** في القائمة الجانبية لواجهة Sentinel، وكذلك صفحة `/osint/` على نفس النطاق. هذه الواجهة تعرض تقارير STAR OSINT من ملفات JSON محلياً في متصفحك، وتوفر زر فتح خادم Kali المحلي.

### خطوات العمل

1. على Kali، افتح `~/star-osint-v2/star-osint-ai` ونفّذ `./start.sh` مع Ollama العامل على `127.0.0.1:11434`.
2. من الواجهة المحلية `http://127.0.0.1:8787` سجّل الدخول، نفّذ فحص OSINT من المصادر العامة، وبعد اكتماله استخدم زر تحليل Ollama إذا أردت.
3. من التقرير، اختر **Download JSON**، أو افتح `/reports/<scan_id>/download?format=json` داخل المنصة بعد تسجيل الدخول.
4. افتح Wormstar Sentinel، ثم **مختبر STAR OSINT** ثم **فتح مختبر STAR OSINT** (مسار `/osint/`).
5. استورد ملف JSON الذي نزّلته. سيظهر النطاق والحالة والأدلة والتوصيات محلياً داخل المتصفح؛ يمكنك البحث والتصفية.

### الخصوصية والحدود

- لا يوجد رفع تلقائي لملف التقرير إلى Cloudflare، ولا ربط مباشر لخادم Kali بواجهة Cloudflare. المحتوى المستورد يبقى بذاكرة المتصفح ولا يُخزّن في D1 أو GitHub.
- زر لوحة Kali المحلية يستخدم `127.0.0.1:8787`، ويشير إلى الكمبيوتر الذي يفتح المتصفح؛ لن يصل إلى Kali من جهاز خارجي إلا عند إعداد اتصال خاص معزول مستقلاً.
- نموذج Qwen يعمل عبر Ollama المحلي، ولا يتم كشف منفذ Ollama `11434` للإنترنت.
- صفحة `/osint/` لا تنفذ أدوات OSINT أو API خاصة بـ Core. فحوص الشبكة الفعلية تعمل على Kali فقط.
- هذا الدمج يُختبر على فرع Pull Request أولاً. نشره إلى عنوان Sentinel يستلزم دمج التغييرات ونشر تطبيق Sentinel عبر Workflow المعتمد، بعد المراجعة والموافقة.
