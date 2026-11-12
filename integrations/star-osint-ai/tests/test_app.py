import re
import time
from fastapi.testclient import TestClient
from app import collectors
from app.main import app


def get_csrf(html):
    match = re.search(r'name="csrf_token" value="([^"]+)"',html)
    assert match is not None
    return match.group(1)

def login(client):
    login_page = client.get('/login')
    csrf = get_csrf(login_page.text)
    login_response = client.post('/login',data={
      'csrf_token':csrf,'username':'tester','password':'goodpassword123'},follow_redirects=False)
    assert login_response.status_code == 303
    return get_csrf(client.get('/').text)

def test_auth_protected():
    with TestClient(app) as client:
        assert client.get('/api/scans/1/status').status_code == 401
        assert client.get('/health').json()['ok']
        assert client.get('/').status_code == 200
        assert '/login' in str(client.get('/').url)

def test_csrf_denied():
    with TestClient(app) as client:
        assert client.post('/projects',data={'domain':'example.org','authorized':'yes'}).status_code == 401
        assert client.post('/login',data={'username':'tester','password':'goodpassword123'}).status_code == 403
        csrf = login(client)
        assert client.post('/projects',data={'domain':'example.org','authorized':'yes','csrf_token':'bad'}).status_code == 403

def test_full_offline_flow(monkeypatch):
    def fake_dns(domain):
        return [collectors.finding('A','192.0.2.10','DNS','high'),
                collectors.finding('TXT','v=spf1 -all','DNS','high')]
    monkeypatch.setitem(collectors.COLLECTORS,'dns',fake_dns)
    with TestClient(app) as client:
        csrf = login(client)
        response = client.post('/projects',data={'domain':'example.org','label':'Test','authorized':'yes','csrf_token':csrf}, follow_redirects=False)
        assert response.status_code == 303
        project_url = response.headers['location']
        project_page = client.get(project_url)
        assert 'example.org' in project_page.text
        scan_response = client.post(project_url+'/scan',data={'collectors':'dns','csrf_token':csrf}, follow_redirects=False)
        assert scan_response.status_code == 303
        scan_url = scan_response.headers['location']
        scan_id = int(scan_url.rsplit('/',1)[-1])
        for _ in range(80):
            status = client.get(f'/api/scans/{scan_id}/status').json()
            if status['scan'] != 'running' and status['scan'] != 'queued':
                break
            time.sleep(.05)
        assert status['scan'] == 'done', status
        assert status['findings'] == 2
        assert '192.0.2.10' in client.get(scan_url).text
        assert '192.0.2.10' in client.get(f'/reports/{scan_id}/download?format=csv').text
        assert 'example.org' in client.get(f'/reports/{scan_id}/download?format=html').text
        assert client.get(f'/reports/{scan_id}').status_code == 200
        assert 'نتائج أولية' in client.get(f'/reports/{scan_id}').text
        assert client.get('/reports/99999').status_code == 404
        assert client.get(f'/reports/{scan_id}/download?format=bad').status_code == 400
        assert client.post(f'/scans/{scan_id}/analyze',data={'csrf_token':'invalid'}).status_code == 403


def test_project_accepts_any_public_domain_url_without_ownership_checkbox():
    with TestClient(app) as client:
        csrf = login(client)
        response = client.post('/projects', data={
            'domain': 'https://WWW.Public-Example.org/news?q=test',
            'label': 'Public Sources', 'csrf_token': csrf,
        }, follow_redirects=False)
        assert response.status_code == 303
        page = client.get(response.headers['location'])
        assert page.status_code == 200
        assert 'www.public-example.org' in page.text
        assert 'PASSIVE / PUBLIC SOURCES' in page.text

def test_public_domain_form_no_ownership_confirmation_required():
    with TestClient(app) as client:
        login(client)
        html = client.get('/').text
        assert 'النطاق أو الرابط' in html
        assert 'name="authorized"' not in html
