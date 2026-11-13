# WORMSTAR — دمج البوابة الموحدة (Core / NEXUS / OSINT / Audit)

## القرار الهندسي

المنصة فيها **خدمتان مستقلتان** على Cloudflare:

- `wormstar-ai-lab`: Core AI (واجهة النموذج والمصادقة والذاكرة) وNEXUS `/workspace` وبوابات AI.
- `wormstar-sentinel-preview`: Sentinel UI بالإضافة إلى عارض OSINT المحلي وiSH Audit المحلي.

Core يحمي صفحاته بـ`X-Frame-Options: DENY` و`frame-ancestors 'none'` ويستخدم مجموعة خاصة من واجهات `/api/*` والمصادقة. لذلك **لا يجوز نسخه في iframe أو نقل كوكي/رمز مصادقة بين النطاقين**. هذا الدمج يعطي مركز دخول موحد وروابط ومسارات متسقة، ويحافظ على وظائف Core الأصلية خلف صفحة المالك؛ لا يدّعي توفير SSO أو استنساخ كل مكونات Core داخل Sentinel.

## المسارات الجديدة والموجودة

| العنوان في Sentinel | الوظيفة |
| --- | --- |
| `/` | صفحة البداية الموحدة، روابط واضحة لخدمات Core/NEXUS/OSINT/Audit مع بقاء لوحة Sentinel الحالية |
| `/workspace/` | صفحة محلية داخل Sentinel: كتالوج التطبيقات، فحص صحة الخدمات، وعمليات Core المسموحة بعد تسجيل دخول AI |
| `/core/` | Redirect ثابت 302 إلى `https://wormstar-ai-lab.abdulstarzeki001.workers.dev/` |
| `/core/workspace` | Redirect ثابت إلى `https://wormstar-ai-lab.abdulstarzeki001.workers.dev/workspace` |
| `/osint/` | عارض STAR OSINT الأصلي؛ يستورد JSON إلى متصفح المستخدم دون رفعه للخادم |
| `/audit/` | عارض iSH Static Audit الأصلي؛ يستهلك بيانات النموذج المحلية والعينات الاصطناعية |
| `GET /api/suite/status` | فحص صحة محدود من الربط الداخلي `CORE` وأصل وحدات OSINT/Audit؛ يعرض Flags فقط |

**المصادقة:** صفحة Sentinel تستخدم `POST /api/auth` بنفس مفتاح مالك Core، وتحتفظ بالمفتاح في الذاكرة فقط. عمليات `/api/repo/status` و`/api/rag/status` و`/api/agents` المضافة إلى Workspace تستعمل دالة `opsRequest` الموجودة سابقاً ولا تسمح بالطلبات المجهولة. فتح Core/NEXUS على نطاق Core يتطلب تسجيل الدخول هناك بصورة مستقلة.

**العزل:** مسارات `/osint` و`/audit` لا ترث جلسات Core، ولا تنتقل ملفات المستخدم إلى Core. تبقى سياسة CSP لكل عارض كما كانت: `connect-src 'none'` لـOSINT، ومراجعة ساكنة محلية لـAudit. أضيفت روابط تنقل فقط داخل الصفحات دون تفعيل API أو أذونات جديدة.

**أمن التحويلات:** قائمة `/core` تسمح بمسارين ثابتين فقط؛ لا تقبل رابط وجهة من Query Parameters، ولا تمرر Query Strings أو Headers أو بيانات اعتماد. `GET /api/suite/status` يستدعي `/api/health` من Core عبر Service Binding بدون Bearer ويعرض فقط حالة الاستجابة، لا مخرجات Core الداخلية.

## الفحص

شغّل:

```bash
cd wormstar-ui
npm test
```

اختبارات `test-unified-suite.mjs` تتحقق من الصفحات والروابط، حظر الرفع، حماية Core، تحويلات المسارات، المحتوى العام، وعزل الحزم. إضافة هذا الملف إلى `package.json` تجعله يعمل ضمن Sentinel Quality Gate في CI. تُشغّل اختبارات Core, OSINT, Audit, Terminal والبوابات الأمنية أيضاً ضمن `.github/workflows/quality-gate.yml`.

## قبل الدمج والنشر

- راجع الـPull Request والتغييرات على الهاتف وRTL/LTR.
- اختبر مسارات Core بعد Cloudflare Access والدخول الفعلي بشكل يدوي.
- راجع سجل Quality Gate للفرع المطلوب، ولا تنشر إلى Production قبل الموافقة.
- هذه التغييرات ليست SSO، ولا تدمج قاعدة بيانات أو صلاحيات أو أسرار Core في Sentinel.

ملاحظة: بناء التأثيرات GSAP/Lenis من PR مستقل سابق ولا يعتمد عليه هذا الدمج. لا تخلط تغييرات متنافسة للواجهة دون ترتيب مراجعة ودمج واضح.
