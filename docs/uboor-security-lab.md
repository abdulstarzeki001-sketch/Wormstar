# UBOOR security lab integration in Wormstar

تم دمج مختبر UBOOR التدريبي كحزمة مستقلة في `training/uboor-security-lab`، دون تغيير كود تشغيل `wormgpt.py` أو الواجهة السحابية.

## التشغيل على Kali / Linux

من جذر المستودع:

```bash
bash scripts/run-uboor-lab.sh
```

ستُشغّل اختبارات Python ووحدة الأوزان، ومحاكاة ترويسة المصادقة، ومختبر SQLite للتزامن، وتحليلات HAR وJSON وJavaScript على بيانات اصطناعية.

عند اكتمال التشغيل، سيظهر `ALL LOCAL LABS COMPLETED`. تُحفظ التقارير محليًا في `training/uboor-security-lab/reports/` ولا تدخل Git.

## GitHub Actions

ملف `.github/workflows/uboor-offline-lab.yml` يختبر الحزمة على Pull Requests والتحديثات المتعلقة بها، بدون اتصالات إلى UBOOR.

## النطاق والخصوصية

هذه الوحدة للأبحاث الدفاعية المحلية والتعلم، وليست واجهة لإنشاء شحنات أو التواصل مع النظام الحكومي.
لا ترفع تسجيلات HAR الحقيقية أو QR موقعة أو Cookies أو قيم Authorization أو ملفات JS غير المرخص بنشرها إلى مستودع Wormstar العام.

## حدود النتائج

- `HTTP 200` لا يثبت تحديث قاعدة البيانات.
- تكرار الطلبات في HAR لا يثبت تكرار خصم أرصدة.
- وجود حساب عميل وترويسة Authorization في JavaScript لا يثبت تجاوز صلاحيات.
- بيانات العينات مولّدة اصطناعيًا.
- لا توجد نتائج حية مثبتة من هذه الاختبارات.

للاطلاع على شرح أدوات المختبر: `training/uboor-security-lab/README.md`.
