"""Evidence-first analysis, repeat-scan deltas, and passive DNS observations.

No outbound requests or model calls here: only persisted evidence is analyzed.
"""
import hashlib
import json
from collections import Counter
from .db import connect

SOURCE_NAME = {
    'dns': 'DNS', 'ct': 'crt.sh', 'whois': 'whois',
    'harvester': 'theHarvester/crtsh', 'amass': 'amass/passive',
}


def evidence_fingerprint(domain, findings):
    """Stable digest of a *snapshot*, independent of row IDs and collection time."""
    records = sorted({(str(f['kind']), str(f['value']), str(f['source'])) for f in findings})
    payload = json.dumps({'domain': domain, 'evidence': records}, ensure_ascii=False,
                         separators=(',', ':'), sort_keys=True)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def dns_observations(scan, findings, source_runs):
    """Observations only; absence in passive results is NOT a proven vulnerability."""
    completed = any(x['source'] == 'dns' and x['status'] == 'done' for x in source_runs)
    if not completed:
        return [{'key': 'DNS', 'label': 'DNS baseline', 'state': 'unknown',
                 'detail': 'لم يكتمل جمع DNS؛ لا يمكن استنتاج إعداداته.'}]
    txt = [str(x['value']).lower() for x in findings if x['kind'] == 'TXT'
           and x['source'] == 'DNS']
    dmarc = [str(x['value']).lower() for x in findings if x['kind'] == 'DMARC'
             and x['source'] == 'DNS']
    kinds = {str(x['kind']) for x in findings if x['source'] == 'DNS'}
    return [
      {'key': 'SPF', 'label': 'SPF', 'state': 'observed' if any('v=spf1' in s for s in txt) else 'unobserved',
       'detail': 'تم رصد سياسة SPF منشورة.' if any('v=spf1' in s for s in txt) else 'لم تظهر سياسة SPF في نتائج هذا الفحص؛ تحقق بشكل مستقل.'},
      {'key': 'DMARC', 'label': 'DMARC', 'state': 'observed' if any('v=dmarc1' in s for s in dmarc) else 'unobserved',
       'detail': 'تم رصد سياسة DMARC منشورة.' if any('v=dmarc1' in s for s in dmarc) else 'لم تظهر سياسة DMARC في النتائج؛ تحقق بشكل مستقل.'},
      {'key': 'CAA', 'label': 'CAA', 'state': 'observed' if 'CAA' in kinds else 'unobserved',
       'detail': 'تم رصد سجل CAA.' if 'CAA' in kinds else 'لم يُرصد CAA خلال هذا الفحص؛ ليس إثباتاً لثغرة.'},
    ]


def compare_snapshots(scan_id):
    """Compare newest completed previous scan using ONLY collectors shared by both."""
    with connect() as db:
        current = db.execute('SELECT * FROM scans WHERE id=?', (scan_id,)).fetchone()
        if current is None:
            raise ValueError('Scan not found')
        older = db.execute('''SELECT * FROM scans WHERE project_id=? AND id<? AND status='done'
                              ORDER BY id DESC LIMIT 1''', (current['project_id'],scan_id)).fetchone()
        if older is None or current['status'] != 'done':
            return {'baseline': None, 'added': [], 'removed': [], 'added_count': 0,
                    'removed_count': 0, 'common_sources': [], 'message': 'لا يوجد فحص مكتمل سابق قابل للمقارنة.'}
        try:
            common = sorted(set(json.loads(current['options_json'])) & set(json.loads(older['options_json'])))
        except (ValueError, TypeError):
            common = []
        source_runs = db.execute('SELECT scan_id,source,status FROM scan_sources WHERE scan_id IN (?,?)',
                                 (scan_id,older['id'])).fetchall()
        successful = {
            sid:{r['source'] for r in source_runs if r['scan_id']==sid and r['status']=='done'}
            for sid in (scan_id, older['id'])
        }
        # Legacy v1.1 scans had no per-source status: only compare if the scan was
        # cleanly completed; treat this as an unverified legacy baseline.
        legacy = not any(r['scan_id']==older['id'] for r in source_runs)
        if legacy and not older['error']:
            successful[older['id']] = set(json.loads(older['options_json']))
        if not any(r['scan_id']==scan_id for r in source_runs) and not current['error']:
            successful[scan_id] = set(json.loads(current['options_json']))
        common = [s for s in common if s in successful[scan_id] and s in successful[older['id']]]
        sources = {SOURCE_NAME[s] for s in common if s in SOURCE_NAME}
        rows = db.execute('''SELECT scan_id,kind,value,source FROM findings
                             WHERE scan_id IN (?,?)''', (scan_id,older['id'])).fetchall()
    before = {(r['kind'],r['value'],r['source']) for r in rows if r['scan_id']==older['id'] and r['source'] in sources}
    after = {(r['kind'],r['value'],r['source']) for r in rows if r['scan_id']==scan_id and r['source'] in sources}
    def serialize(items):
        return [{'kind': k, 'value': v, 'source': s} for k,v,s in sorted(items)[:150]]
    return {'baseline': older['id'], 'added': serialize(after-before), 'removed': serialize(before-after),
            'added_count':len(after-before), 'removed_count':len(before-after),
            'common_sources':common, 'message': (
                'مقارنة تاريخية مع بيانات v1.1 (لا تتوفر حالة كل مصدر). ' if legacy else ''
            ) + 'تُقارن المصادر المشتركة المكتملة فقط؛ التغيّر في نتائج المصدر لا يثبت تغيّر الأصل.'}


def workspace_stats():
    with connect() as db:
        status = {r['status']:r['count'] for r in db.execute('SELECT status,COUNT(*) count FROM scans GROUP BY status')}
        kinds = [dict(r) for r in db.execute('''SELECT kind,COUNT(*) count FROM findings
                                                GROUP BY kind ORDER BY count DESC LIMIT 10''')]
        top = [dict(r) for r in db.execute('''SELECT p.domain,COUNT(f.id) findings FROM projects p
                            LEFT JOIN scans s ON s.project_id=p.id
                            LEFT JOIN findings f ON f.scan_id=s.id GROUP BY p.id ORDER BY findings DESC LIMIT 8''')]
        counts = {t: db.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
                  for t in ('projects','scans','findings','reports')}
        audit_items = [dict(r) for r in db.execute('''SELECT action,detail,created_at FROM audit
                                                       ORDER BY id DESC LIMIT 12''')]
    return {'status':status, 'kinds':kinds, 'top':top, 'counts':counts, 'audit':audit_items}
