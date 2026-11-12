import csv
import html
import io
import json
from collections import Counter
from .ai import evidence_bundle
from .analytics import compare_snapshots, dns_observations, evidence_fingerprint
from .db import connect

CSS = '''body{font-family:Tahoma,Arial,sans-serif;direction:rtl;max-width:980px;margin:40px auto;padding:0 24px;background:#fff;color:#1b2435;line-height:1.8}h1{color:#11656b}h2{margin-top:28px;color:#164b63}.muted{color:#66778a}table{border-collapse:collapse;width:100%;direction:ltr;text-align:left;font-size:12px;word-break:break-word}td,th{padding:8px;border:1px solid #dce4ee}th{background:#f2f6fa} .finding{color:#234} .print{padding:8px 12px;background:#11656b;color:white;border:0;border-radius:5px;cursor:pointer}@media print{.print{display:none}body{margin:12px}}'''

def report_data(scan_id):
    scan, findings = evidence_bundle(scan_id)
    with connect() as db:
        row = db.execute('SELECT * FROM reports WHERE scan_id=?', (scan_id,)).fetchone()
    report = dict(row) if row else None
    summary = None
    if report and report['status'] == 'done':
        summary = json.loads(report['summary_json'])
    with connect() as db:
        runs = [dict(x) for x in db.execute('SELECT * FROM scan_sources WHERE scan_id=? ORDER BY id', (scan_id,))]
    cited_ids = set(summary.get('evidence_ids', [])) if summary else set()
    cited = [f for f in findings if f['id'] in cited_ids]
    return {'cited_evidence':cited, 'scan':scan, 'findings':findings, 'report':report,
            'summary':summary, 'stats':dict(Counter(x['kind'] for x in findings)),
            'sources':runs, 'observations':dns_observations(scan,findings,runs),
            'diff':compare_snapshots(scan_id),
            'fingerprint':evidence_fingerprint(scan['domain'],findings)}

def to_markdown(data):
    scan = data['scan']
    items = [f"# تقرير OSINT — {scan['domain']}", '',
             f"- Scan ID: {scan['id']}", f"- Status: {scan['status']}",
             f"- Created: {scan['created_at']}", f"- Findings: {len(data['findings'])}", f"- SHA256 snapshot: {data.get('fingerprint','')}", '']
    if data['summary']:
        summary = data['summary']
        items += ['## الملخص التحليلي', summary.get('executive_summary',''), '']
        for name, key in [('الملاحظات','highlights'),('المخاطر المحتملة','risks'),
                          ('التوصيات','recommendations'),('القيود','limitations')]:
            items += [f'## {name}'] + [f'- {v}' for v in summary.get(key, [])] + ['']
    else:
        items += ['> لم يُنفذ تحليل Ollama محلي لهذا الفحص. النتائج الخام أدناه فقط.', '']
    if data.get('cited_evidence'):
        items += ['## أدلة مرجعية أشار إليها النموذج (تحقق من ملاءمتها لكل ادّعاء)']
        items += [f"- [{r['id']}] {r['kind']}: {r['value']} ({r['source']})" for r in data['cited_evidence']]
        items += ['']
    if data.get('observations'):
        items += ['## ملاحظات DNS (غير حاسمة)'] + [f"- {v['key']}: {v['detail']}" for v in data['observations']] + ['']
    if data.get('diff',{}).get('baseline'):
        d = data['diff']
        items += [f"## مقارنة بالفحص #{d['baseline']}", f"- إضافات مرصودة: {d['added_count']}",
                  f"- عناصر لم تعد مرصودة: {d['removed_count']}", '- ' + d['message'], '']
    items += ['## الأدلة (نوع | قيمة | مصدر | درجة ثقة)']
    for r in data['findings']:
        vals = [str(r.get(k,'')) for k in ['kind','value','source','confidence']]
        items.append('- ' + ' | '.join(s.replace('\n',' ') for s in vals))
    return '\n'.join(items) + '\n'

def to_html(data):
    esc = lambda s: html.escape(str(s),quote=True)
    s = data['scan']
    parts = ['<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width,initial-scale=1">',
             '<title>STAR OSINT Report</title><style>', CSS, '</style></head><body>',
             '<button class="print" onclick="window.print()">طباعة / حفظ PDF</button>',
             f'<h1>تقرير OSINT — {esc(s["domain"])}</h1>',
             f'<p class="muted">رقم الفحص: {s["id"]} | التاريخ: {esc(s["created_at"])} | الأدلة: {len(data["findings"])}</p>']
    summary = data['summary']
    if summary:
        parts += ['<h2>الملخص التنفيذي</h2><p>', esc(summary.get('executive_summary','')), '</p>']
        for label, key in [('أهم الملاحظات','highlights'),('المخاطر المحتملة','risks'),
                           ('التوصيات','recommendations'),('محددات التحليل','limitations')]:
            parts.append(f'<h2>{label}</h2><ul>')
            parts += [f'<li>{esc(v)}</li>' for v in summary.get(key,[])]
            parts.append('</ul>')
    else:
        parts.append('<p class="muted">لم يتم تنفيذ تحليل الذكاء الاصطناعي لهذا الفحص.</p>')
    if data.get('cited_evidence'):
        parts.append('<h2>الأدلة المرجعية التي اختارها النموذج</h2><ul>')
        for r in data['cited_evidence']:
            parts.append(f'<li>[{int(r["id"])}] {esc(r["kind"])}: {esc(r["value"])} ({esc(r["source"])})</li>')
        parts.append('</ul><p class="muted">اختيار النموذج للأدلة لا يثبت صحة أي استنتاج؛ راجعها يدوياً.</p>')
    parts.append('<h2>ملاحظات إعدادات DNS (ليست ثغرات مثبتة)</h2><ul>')
    for obs in data.get('observations', []):
        parts.append(f'<li><b>{esc(obs["key"])}</b>: {esc(obs["detail"])}</li>')
    parts.append('</ul>')
    diff = data.get('diff', {})
    if diff.get('baseline'):
        parts.append(f'<h2>المقارنة مع الفحص #{int(diff["baseline"])}</h2><p>إضافات مرصودة: {int(diff["added_count"])} — عناصر لم تعد مرصودة: {int(diff["removed_count"])}. {esc(diff["message"])}</p>')
    parts.append(f'<p class="muted">Snapshot SHA-256: {esc(data.get("fingerprint", ""))}</p>')
    parts.append('<h2>سجل الأدلة</h2><table><thead><tr><th>ID</th><th>Type</th><th>Value</th><th>Source</th><th>Confidence</th></tr></thead><tbody>')
    for f in data['findings']:
        parts.append('<tr>' + ''.join(f'<td>{esc(f[key])}</td>' for key in ('id','kind','value','source','confidence')) + '</tr>')
    parts += ['</tbody></table><p class="muted">معلومات مفتوحة المصدر، تحتاج تحققاً مستقلاً قبل أي قرار.</p></body></html>']
    return ''.join(parts)

def to_csv(data):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['id','kind','value','source','confidence'])
    for f in data['findings']:
        vals = []
        for key in ('id','kind','value','source','confidence'):
            text = str(f[key]).replace('\x00','')
            if text.lstrip(' \t\r\n').startswith(('=', '+', '-', '@')):
                text = "'" + text
            vals.append(text)
        writer.writerow(vals)
    return '\ufeff' + output.getvalue()
