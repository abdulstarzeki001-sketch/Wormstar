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
