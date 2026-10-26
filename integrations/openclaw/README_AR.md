# تشغيل OpenClaw الأصلي داخل مشروع Wormstar NEO

## الحالة الفعلية — 26 أكتوبر 2026

- **تم جلب وربط المستودع الأصلي** `openclaw/openclaw` كـ Git submodule باسم `OpenClaw/`، مثبت على الالتزام `cd3bcc01765305ff1a44f70ca187734269183965`.
- تحتوي شجرة GitHub على مصدر OpenClaw الكامل عند استنساخ submodule. لا تُنسخ آلاف الملفات إلى مصدر Cloudflare Worker ولا يُعدّل كود Wormstar Python/Ollama.
- واجهة Wormstar متكاملة مسبقاً مع `/api/openclaw/status` و`/api/chat` (المحرك `openclaw-agent`). الاختيار يبقى معطلاً حتى يرد خادم Gateway حقيقي ويُرجع `openclaw/default`.
- **OpenClaw Gateway ليس في وضع تشغيل حيّ الآن.** حساب Cloudflare الحالي رفض Containers لأنه يتطلب Workers Paid؛ وDigitalOcean لا يحتوي على Droplet متاح حالياً. الربط البرمجي أو submodule وحده لا يشغّل خدمة Node.js مستمرة.

## تشغيل الخادم الأصلي على جهاز Linux مع Docker

هذه أوامر لتُنفَّذ على **خادم تتحكم به**. لا تنفذها على الآيفون ولا في Cloudflare Worker:

```bash
git clone https://github.com/abdulstarzeki001-sketch/Wormstar.git
cd Wormstar
git submodule update --init OpenClaw
bash integrations/openclaw/setup.sh
bash integrations/openclaw/setup.sh --install
bash integrations/openclaw/enable-wormstar-api.sh
```

تتحقق `setup.sh` من توفر Docker وDocker Compose وPython وملفات OpenClaw الأصلية، ثم تستخدم ملف `integrations/openclaw/docker-compose.extra.yml` لإلزام جميع المنافذ المنشورة بالاستماع على `127.0.0.1` فقط. هذا يتطلب Docker Compose 2.24.4 أو أحدث بسبب `!override`.

معامل `--install` يبدأ أداة الإعداد الرسمية من المستودع المثبت (`OpenClaw/scripts/docker/setup.sh`)، بعد تأكيد محلي صريح. قد يحمّل صورة Docker أو يبنيها ويطلب مفاتيح موفر نموذج ذكي. **لا يبدأ الخادم تلقائياً عند حفظ هذه الملفات في GitHub**.

بعد إكمال الإعداد، يقوم `enable-wormstar-api.sh` بإيقاف Gateway مؤقتاً، وتفعيل `gateway.http.endpoints.chatCompletions.enabled` عبر CLI الرسمي ثم إعادة تشغيله. هذا ضروري لأن واجهة `/v1/chat/completions` معطلة افتراضياً.

للتأكد من التشغيل المحلي: `docker compose -f docker-compose.yml -f docker-compose.extra.yml ps` داخل `OpenClaw/`، ثم `GET http://127.0.0.1:18789/v1/models` مع `Authorization: Bearer <GATEWAY_TOKEN>`. يجب أن تتضمن النتيجة `openclaw/default`.

## الربط الآمن مع Cloudflare Worker

لا تفتح المنفذ `18789` للعامة. Gateway token يمنح صلاحيات مشغّل عالية، لذا يجب أن يكون endpoint خلف **نطاق HTTPS خاص، Cloudflare Tunnel وCloudflare Access** أو طبقة خاصة مماثلة. تحتاج نطاقاً تملكه ويمكن ضبط الوصول إليه. لا تعتمد على الرابط `workers.dev` لنشر Gateway نفسه.

اضبط هذه القيم **كأسرار Cloudflare Worker فقط** من لوحة Cloudflare، لا تكتبها في GitHub ولا ترسلها في المحادثة:

| Secret | الاستخدام |
| --- | --- |
| `OPENCLAW_GATEWAY_URL` | جذر عنوان Gateway الخارجي المحمي HTTPS، مثل `https://gateway.example.com/` |
| `OPENCLAW_GATEWAY_TOKEN` | رمز Gateway الخاص، المستخدم في رأس Authorization |
| `OPENCLAW_ACCESS_CLIENT_ID` | معرّف Cloudflare Access Service Token |
| `OPENCLAW_ACCESS_CLIENT_SECRET` | سر Cloudflare Access Service Token |

تحقق من بقاء أسرار Wormstar القديمة `WORMSTAR_ACCESS_TOKEN` وبقية bindings عند إعادة نشر Worker. لا تستبدلها بالرموز الجديدة.

بعد الربط افتح Wormstar، وسجل الدخول، ثم اختر **OpenClaw** في مركز التحكم أو محرك المحادثة. الواجهة ترسل طلباً محمياً إلى `/api/openclaw/status`، ولا تفعّل OpenClaw إلا بعد تحقق الخادم من `GET /v1/models` ووجود `openclaw/default`.

## حدود الصلاحيات والخصائص

- يوفر OpenClaw الوكلاء والجلسات والأدوات والمهارات والقنوات والإضافات، لكن تثبيت submodule لا يعني تفعيلها. إعداد القنوات والأجهزة يتطلب pairing ومفاتيح وموافقات منفصلة.
- Wormstar يمرر **نص المحادثة المسموح به** فقط إلى Gateway؛ لا يفتح API إدارة Gateway أو تشغيل shell من المتصفح.
- أخطر نقطة أمنية: OpenClaw `/v1/chat/completions` يستخدم صلاحيات المشغّل المرتبطة برمز Gateway. لا تمنحه أذونات تشغيل أو متصفح أو ملفات مهمة قبل إعداد sandbox وقوائم السماح والموافقات.
- ذاكرة OpenClaw مستقلة عن Cloudflare D1 وSupabase؛ لا تزامن السجلات تلقائياً ولا تعتبر OpenClaw تدريباً جديداً لأوزان GPT-OSS.
- تحديث OpenClaw يكون عبر تحديث submodule بعد مراجعة الإصدارات، وليس سحب `main` وتغيير كود Wormstar بصمت.

## مراجع رسمية

- [المستودع الأصلي](https://github.com/openclaw/openclaw)
- [تثبيت Docker الرسمي](https://docs.openclaw.ai/install/docker)
- [OpenAI-compatible HTTP API](https://docs.openclaw.ai/gateway/openai-http-api)
- [أمان Gateway](https://docs.openclaw.ai/gateway/security)
- [تثبيت Cloudflare Containers](https://github.com/openclaw/openclaw/blob/main/docs/install/cloudflare.md) — يحتاج Containers وR2 وخطة مناسبة

**نقطة الإكمال المطلوبة:** بيئة تشغيل Node/Docker دائمة مع عنوان HTTPS محمي، ثم تهيئة OpenClaw ومفاتيح الربط. لا يمكن اختبار اتصال حيّ قبل وجود تلك البيئة.
