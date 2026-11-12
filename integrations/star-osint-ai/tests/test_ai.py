import json
from app import ai
from app.db import connect, utcnow, init_db


def test_ollama_structured_offline_response(monkeypatch):
    init_db()
    with connect() as db:
        db.execute('INSERT OR IGNORE INTO projects(domain,label,authorized,created_at) VALUES (?,?,?,?)',('ai-unit.example','AI unit',1,utcnow()))
        proj = db.execute('SELECT id FROM projects WHERE domain=?',('ai-unit.example',)).fetchone()[0]
        sid = db.execute("INSERT INTO scans(project_id,status,created_at,options_json) VALUES (?,'done',?,'[]')",(proj,utcnow())).lastrowid
        fid = db.execute("INSERT INTO findings(scan_id,kind,value,source,confidence,detail_json,collected_at) VALUES (?,?,?,?,?,?,?)",(sid,'A','192.0.2.45','DNS','high','{}',utcnow())).lastrowid
        db.execute("INSERT INTO reports(scan_id,status,created_at,updated_at) VALUES (?,'queued',?,?)", (sid,utcnow(),utcnow()))
    seen = {}
    class StubResponse:
        def raise_for_status(self): pass
        def json(self):
            return {'message':{'content':json.dumps({
                'executive_summary':'دليل واحد محفوظ من مصدر DNS.',
                'highlights':['تم جمع A record'],
                'risks':[], 'recommendations':['تحقق من إعداد DNS'],
                'limitations':['لم نختبر أياً من الخدمات'],
                'evidence_ids':[fid,999999]
             }, ensure_ascii=False)}}
    class StubClient:
        def __init__(self,**kwargs): pass
        def __enter__(self): return self
        def __exit__(self,*exc): pass
        def get(self,url):
            return StubResponse()
        def post(self,url,json):
            seen['url'] = url; seen['payload'] = json
            return StubResponse()
    monkeypatch.setattr(ai.httpx, 'Client', StubClient)
    ai.analyze_local(sid)
    with connect() as db:
        result = dict(db.execute('SELECT * FROM reports WHERE scan_id=?',(sid,)).fetchone())
    assert seen['url'] == 'http://127.0.0.1:11434/api/chat'
    assert seen['payload']['stream'] is False
    assert result['status'] == 'done'
    summary = json.loads(result['summary_json'])
    assert summary['evidence_ids'] == [fid]
    assert 'دليل واحد' in summary['executive_summary']
    # Render the AI report screen with a real FastAPI test session.
    from fastapi.testclient import TestClient
    from app.main import app
    import re
    with TestClient(app) as client:
        login_html = client.get('/login').text
        token = re.search(r'name="csrf_token" value="([^"]+)"', login_html).group(1)
        client.post('/login',data={'username':'tester','password':'goodpassword123','csrf_token':token})
        view = client.get(f'/reports/{sid}')
        assert view.status_code == 200
        assert 'دليل واحد محفوظ' in view.text
        assert 'تحقق من إعداد DNS' in view.text
