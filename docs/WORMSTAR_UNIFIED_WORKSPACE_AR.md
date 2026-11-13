# مركز مشاريع Wormstar الموحّد — NEXUS Workspace

المسار المقترح بعد نشر Core: **`/workspace`** (والاسم المستعار `/projects`) داخل Worker الحالي `wormstar-ai-lab`.

## القرار الهندسي

حافظنا على واجهة `/` الأصلية، وكل APIs ونماذج Workers AI وD1 وVectorize وCloudflare Access وBearer auth. لا يغيّر هذا الدمج واجهات الدردشة السابقة ولا قواعد D1 ولا أسرار Cloudflare، ولا يستبدل `wormstar-ui` أو `cloud-app` أو مشروع Python المحلي.

- `cloudflare-worker/unified-workspace.js`: صفحة RTL جديدة، مركز تنقل وبحث في 15 وحدة، أدوات متصلة إلى Core.
- `cloudflare-worker/worker.js`: يضيف فقط مساري GET `/workspace` و`/projects` ويدرج رابطاً عائماً داخل NEXUS الحالية. بقية المسارات باقية دون تغيير.
- `cloudflare-worker/tests/unified-workspace.test.mjs`: اختبارات تشغيل API والصفحة وعزل التفويض.

## الخدمات المتصلة مباشرة من المركز

| الخدمة | المسار/المصادقة | الحدود |
|---|---|---|
| Workers AI للمحادثة | `POST /api/chat` + Bearer owner token | نماذج مستضافة، لا Shell |
| الإجابة المقيدة بالمستودع | `POST /api/repo/ask` + Bearer | قد لا يكتمل فهرس GitHub |
| فحص ترويسات HTTPS | `POST /api/security/header-audit` + Bearer + إذن النطاق | جذر نطاق موجود في allowlist، طلب GET واحد |
| وكلاء التحليل | `POST /api/agents/run` + Bearer | مراجعة نصية فقط |
| RAG / GitHub status | `GET /api/rag/status`, `GET /api/repo/status` + Bearer | قراءة فقط |
| OpenClaw / GoClaw / OpenCode | مسارات `/api/*/status` | اتصال خارجي اختياري، ليس مضموناً |
| Academy | `GET /academy` | صفحة موجودة ضمن Worker |

تستعمل الواجهة مفتاح المالك الموجود في `sessionStorage` ضمن نفس تبويب الويب، أو تطلبه صراحة. لا يوضع المفتاح في الروابط أو مستودع GitHub أو نصوص الاستجابة.

## وحدات المصدر التي تتطلب خوادم مستقلة

- `integrations/star-osint-ai`: وكيل OSINT الصادر؛ لا يعمل على Worker وحده. Cloud Bridge المنفصل قيد PR #46، وD1 `osint_jobs` ليس منشأً بعد.
- `integrations/wormstar-linux-terminal`: مضيف Docker وصلاحيات منفصلة.
- `integrations/star-cyber-audit-ish`: تشغيل محلي داخل iSH.
- `training/uboor-security-lab`: مختبر اصطناعي أوفلاين فقط.
- `openclaw/`, `docs/GOCLAW_INTEGRATION_AR.md`: بوابات تحتاج ضبطاً على المضيف ومفاتيح مستقلة.
- `cloudflare-worker/gptoss-selfhost/`: GPU مستقل وليس Workers AI.
- `cloud-app/`: واجهة AppDeploy منفصلة؛ لم تتغير.
- `wormstar-ui/`: Worker Sentinel مستقل ما زال يمكن فتحه من قائمة المركز.

**مهم:** وحدة المشاريع هي فهرس تنقل وتشغيل للوظائف المتصلة بالفعل؛ لا تعني تجميع Python أو Docker أو نماذج Ollama داخل Cloudflare Worker، ولا تجعل جميع الخيارات الخارجية جاهزة بدون إعداد.

## إجراء النشر

1. راجع PR والاختبارات `npm test` في `cloudflare-worker` وWormstar Quality Gate.
2. ادمج PR إلى `main` بالطريقة المعتمدة. لا ترفع أسرار API.
3. راقب Workflow `Deploy Cloudflare Worker` بعد الدمج، والتأكد من نجاح اختبار Core/Sentinel.
4. تحقّق من أن `/workspace` يخضع لنفس Cloudflare Access، وأن `/` ما زالت تعمل، وأن `POST /api/auth` يرفض الطلبات بلا Bearer.
5. افتح NEXUS، ثم «جميع مشاريعي»؛ قم بمصادقة المالك لتجربة وظائف الذكاء الفعلية.

لا يغيّر هذا التحديث جداول D1، ومفاتيح المالك، وسياسات Cloudflare Access، ولا يتطلب ترحيل قاعدة البيانات.
