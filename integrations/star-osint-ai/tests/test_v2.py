from fastapi.testclient import TestClient
from app.db import connect, init_db, utcnow
from app.analytics import dns_observations, evidence_fingerprint, compare_snapshots, workspace_stats
from app.main import app
from app.collectors import finding, save_findings, run_scan, COLLECTORS
from app.reports import report_data, to_html, to_markdown
from test_app import login


def make_scans(domain):
    init_db()
    with connect() as db:
        p = db.execute('INSERT INTO projects(domain,label,authorized,created_at) VALUES (?,?,1,?)', (domain,'V2',utcnow())).lastrowid
        a = db.execute("INSERT INTO scans(project_id,status,created_at,options_json) VALUES (?,'done',?,'[\"dns\",\"ct\"]')",(p,utcnow())).lastrowid
        b = db.execute("INSERT INTO scans(project_id,status,created_at,options_json) VALUES (?,'done',?,'[\"dns\",\"ct\"]')",(p,utcnow())).lastrowid
        for sid in (a,b):
            db.execute("INSERT INTO scan_sources(scan_id,source,status) VALUES (?,'dns','done')",(sid,))
            db.execute("INSERT INTO scan_sources(scan_id,source,status) VALUES (?,'ct','failed')",(sid,))
    return a,b


def test_snapshot_diffs_only_completed_common_collectors():
    a,b = make_scans('diff-v2.example')
    save_findings(a,[finding('A','192.0.2.1','DNS'),finding('subdomain','old.diff-v2.example','crt.sh')])
    save_findings(b,[finding('A','192.0.2.2','DNS'),finding('subdomain','new.diff-v2.example','crt.sh')])
    comparison = compare_snapshots(b)
    assert comparison['baseline'] == a
    assert comparison['common_sources'] == ['dns']
    assert comparison['added_count'] == 1 and comparison['removed_count'] == 1
    assert comparison['added'][0]['value'] == '192.0.2.2'
    assert comparison['removed'][0]['value'] == '192.0.2.1'


def test_fingerprint_independent_of_row_order_and_ids():
    one = [{'kind':'A','value':'192.0.2.2','source':'DNS','id':21},{'kind':'MX','value':'mail','source':'DNS','id':11}]
    two = [dict(reversed(list(x.items()))) for x in one[::-1]]
    assert evidence_fingerprint('example.org',one) == evidence_fingerprint('example.org',two)
    assert evidence_fingerprint('other.org',one) != evidence_fingerprint('example.org',two)


def test_dns_observations_non_deterministic_absence_is_not_vulnerability():
    none = dns_observations({}, [], [])
    assert none[0]['state'] == 'unknown'
    checks = dns_observations({}, [{'kind':'TXT','value':'v=spf1 -all','source':'DNS'},
                                   {'kind':'DMARC','value':'v=DMARC1; p=reject','source':'DNS'}],
                               [{'source':'dns','status':'done'}])
    assert [x['state'] for x in checks] == ['observed','observed','unobserved']
    assert 'ثغرة' in checks[-1]['detail']


def test_report_export_covers_more_than_ai_window_and_snapshot():
    a,b = make_scans('reports-v2.example')
    save_findings(b,[finding('TXT',str(i),'DNS') for i in range(180)])
    data = report_data(b)
    assert len(data['findings']) == 180
    assert len(data['fingerprint']) == 64
    assert data['fingerprint'] in to_html(data)
    assert data['fingerprint'] in to_markdown(data)


def test_v2_authenticated_routes_and_collection_progress(monkeypatch):
    def fake_dns(domain):
        return [finding('A','192.0.2.90','DNS')]
    monkeypatch.setitem(COLLECTORS,'dns',fake_dns)
    init_db()
    with TestClient(app) as client:
        assert client.get('/insights',follow_redirects=False).status_code == 303
        assert client.get('/api/insights').status_code == 401
        csrf = login(client)
        assert client.get('/insights').status_code == 200
        assert client.get('/api/insights').json()['counts']['projects'] >= 0
        response = client.post('/projects',data={'domain':'test-v2.example','label':'v2','csrf_token':csrf},follow_redirects=False)
        purl = response.headers['location']
        response = client.post(purl+'/scan',data={'collectors':'dns','csrf_token':csrf},follow_redirects=False)
        surl = response.headers['location']
        sid = int(surl.rsplit('/',1)[-1])
        from time import sleep
        for _ in range(100):
            status = client.get(f'/api/scans/{sid}/status').json()
            if status['scan'] == 'done':
                break
            sleep(.02)
        assert status['scan'] == 'done'
        assert status['sources'][0]['source'] == 'dns'
        assert status['sources'][0]['status'] == 'done'
        assert status['sources'][0]['findings'] == 1
        assert 'تقدم مصادر الجمع' in client.get(surl).text
        assert client.get(surl+'/compare').status_code == 200
        assert 'SHA-256' in client.get(f'/reports/{sid}').text
