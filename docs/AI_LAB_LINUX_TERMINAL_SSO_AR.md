# Linux Terminal ضمن Wormstar AI Lab — دخول واحد

## التغيير

- داخل واجهة \`https://wormstar-ai-lab.abdulstarzeki001.workers.dev\` يوجد رابط جديد بعنوان **Linux Terminal** في القائمة الرئيسية.
- صفحة \`/terminal\` على نفس نطاق AI Lab تعرض طرفية Linux وتستخدم مفتاح المالك \`wormstar-access\` المحفوظ في **جلسة التبويب الحالية** بعد تسجيل الدخول الأصلي.
- لا توجد صفحة ثانية تطلب كلمة مرور الطرفية.
- التحقق الأمني باقٍ على الخادم، ولا يُحذف رمز المالك الأصلي ولا يتحول رابط Railway إلى طرفية مفتوحة.

## تدفق الاتصال

1. المستخدم يسجّل الدخول إلى Wormstar AI Lab كالمعتاد.
2. يفتح \`/terminal\`. الصفحة تتأكد من صلاحية الجلسة باستخدام \`POST /api/auth\`.
3. تطلب \`POST /api/terminal/session\` مرفقاً بمفتاح المالك. Core يستخدم \`allow()\` الأصلي للتحقق على الخادم.
4. Core يعيد تذكرة HMAC قصيرة العمر (20 ثانية) إلى الصفحة.
5. الصفحة تفتح WebSocket إلى **نفس أصل** AI Lab على \`/api/terminal/ws\` عبر \`Sec-WebSocket-Protocol: wormstar-terminal, ticket.<...>\`.
6. Core يرفض الاتصالات دون Origin صحيح أو تذكرة صحيحة ثم يفتح اتصالاً صادراً ثابتاً إلى Railway على \`/ws\`.
7. كلمة مرور Railway تُرسل من **Cloudflare Worker secret** فقط عبر اتصال الخادم إلى Railway، ولا تصل إطلاقاً إلى المتصفح.
8. يمرر Core أنواع الرسائل \`ready/output/info\` ويقبل من المتصفح \`input/resize\` فقط، مع حدود للأحجام.
9. يبقى تنفيذ الأوامر يدوياً ضمن حاوية Railway؛ لا توجد أوامر AI تلقائية أو امتيازات root جديدة.

## إعداد مطلوب قبل النشر

في Cloudflare Worker **wormstar-ai-lab** أضف Secretين، لا تضع قيمهما في GitHub أو هذه الوثيقة:

- \`TERMINAL_TICKET_SECRET\`: قيمة عشوائية مستقلة بطول 32 محرفاً على الأقل.
- \`TERMINAL_RAILWAY_PASSWORD\`: كلمة مرور خدمة Railway الحالية، ويُفضَّل تدويرها إلى قيمة جديدة قوية ومزامنتها على Railway.

تأكد أن Railway يعمل ضمن حاوية محدودة الصلاحيات. الوجهة المثبتة في \`terminal-gateway.js\`:
\`https://terminal-production-fb16bd35.up.railway.app/ws\`.
لا تقبل وجهة شبكة واردة من مستخدم أو Query String. لا تقم بتمرير مفتاح Wormstar إلى Railway.

### تحذيرات

- لا تستخدم \`TERMINAL_RAILWAY_PASSWORD\` متغيراً عاماً \`[vars]\`؛ يجب أن يكون Secret.
- لا تعطل \`TERMINAL_PASSWORD\` على Railway حتى لو اختفى طلبها في الواجهة الموحّدة. رابط Railway العام ما زال يملك بوابة مستقلة ويتطلب الحماية.
- تذاكر HMAC صالحة لمدة 20 ثانية فقط، لكنها ليست مخزنة في KV أو Durable Object لذا يمكن إعادة استخدامها ضمن تلك النافذة. ينبغي استخدام Cloudflare Access / rate limiting إضافياً قبل الإنتاج الحساس.
- الطرفية ليست Sandbox غير شبكي؛ لا تضع أسرار Cloudflare أو Railway في Shell أو سجلاته.
- حدد معدل الاتصالات، زمن الجلسات والحد الأقصى للجلسات ضمن إعدادات Railway.
- لا تجعل كلمات مرور Railway أو مفاتيح Worker تظهر في HTML أو JS المعروض للمتصفح.

## الاختبارات

نفذ:
\`\`\`bash
cd cloudflare-worker
npm test
\`\`\`

ملف \`tests/terminal-sso.test.mjs\` يغطي التذاكر، التحقق من Owner، انتحال Origin، عزل كلمة مرور Railway، وإرسال أوامر العميل المحدودة بعد جاهزية الطرفية.

**الاختبارات التي لا يمكن للـCI أن تثبتها:** نجاح WebSocket حقيقي عبر Cloudflare Workers إلى Railway، عمل جلسة Bash عن بعد، وأمن Cloudflare Access الفعلي. تُفحص هذه بعد تهيئة Secretين ونشر Preview. لا تعلن جاهزية Production من نجاح unit tests وحده.
