import json
import os
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, Form, Request, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse, PlainTextResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .ai import analyze_local, ollama_health
from .analytics import compare_snapshots, workspace_stats
from .collectors import canonical_domain, COLLECTORS, run_scan
from .config import ROOT, security_config, model_name
from .db import connect, init_db, utcnow, audit
from .reports import report_data, to_csv, to_html, to_markdown
from .security import verify_password, login_allowed, login_failed, login_succeeded, new_token

SECRET, USERNAME, PASSWORD_HASH = security_config()
@asynccontextmanager
async def lifespan(app):
    init_db()
    app.state.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix='osint')
    yield
    app.state.executor.shutdown(wait=False, cancel_futures=True)

app = FastAPI(title='STAR OSINT AI', docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SECRET, session_cookie='star_osint',
                   max_age=3600 * 8, same_site='strict', https_only=False)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1', 'localhost', 'testserver'])
app.mount('/static', StaticFiles(directory=ROOT / 'app' / 'static'), name='static')
TEMPLATES = Jinja2Templates(directory=str(ROOT / 'app' / 'templates'))

@app.middleware('http')
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    response.headers['Content-Security-Policy'] = ("default-src 'self'; img-src 'self' data:; "
       "style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    return response

def auth(request):
    if request.session.get('username') != USERNAME:
        raise HTTPException(status_code=401, detail='Session required')

def csrf(request):
    token = request.session.get('csrf')
    if not token:
        token = new_token()
        request.session['csrf'] = token
    return token

def validate_csrf(request, token):
    import hmac
    original = request.session.get('csrf','')
    if not original or not hmac.compare_digest(original, token or ''):
        raise HTTPException(status_code=403, detail='CSRF token invalid')

def page(request, name, **extra):
    return TEMPLATES.TemplateResponse(request, name, {'csrf':csrf(request),
                       'username':USERNAME, 'model':model_name(), **extra})

def go(path):
    return RedirectResponse(path, status_code=303)

def get_scan(scan_id):
    with connect() as db:
        row = db.execute('''SELECT s.*, p.domain, p.label, p.authorized FROM scans s
                    JOIN projects p ON p.id=s.project_id WHERE s.id=?''',(scan_id,)).fetchone()
    if row is None:
        raise HTTPException(404,'Scan not found')
    return dict(row)

@app.get('/health')
def health():
    return {'ok':True, 'service':'STAR OSINT AI', 'version':'2.0'}

@app.get('/login')
def login_page(request:Request):
    if request.session.get('username') == USERNAME:
        return go('/')
    return page(request, 'login.html', error='')

@app.post('/login')
def login(request:Request, username:str=Form(''), password:str=Form(''), csrf_token:str=Form('')):
    validate_csrf(request, csrf_token)
    address = request.client.host if request.client else 'unknown'
    if not login_allowed(address):
        return page(request, 'login.html', error='محاولات كثيرة. حاول بعد 15 دقيقة.')
    if username == USERNAME and verify_password(password, PASSWORD_HASH):
        login_succeeded(address)
        request.session.clear()
        request.session['username'] = USERNAME
        request.session['csrf'] = new_token()
        audit('login','Local administrator')
        return go('/')
    login_failed(address)
    return page(request, 'login.html', error='بيانات الدخول غير صحيحة')

@app.post('/logout')
def logout(request:Request, csrf_token:str=Form('')):
    auth(request); validate_csrf(request,csrf_token)
    request.session.clear()
    return go('/login')

@app.get('/')
def home(request:Request):
    if request.session.get('username') != USERNAME:
        return go('/login')
    with connect() as db:
        projects = [dict(x) for x in db.execute('''SELECT p.*,
         (SELECT COUNT(*) FROM scans s WHERE s.project_id=p.id) AS scans,
         (SELECT COUNT(*) FROM findings f JOIN scans s ON f.scan_id=s.id WHERE s.project_id=p.id) AS findings
         FROM projects p ORDER BY id DESC LIMIT 200''').fetchall()]
        recent = [dict(x) for x in db.execute('''SELECT s.id,s.status,s.created_at,p.domain,
         (SELECT COUNT(*) FROM findings f WHERE f.scan_id=s.id) AS findings
         FROM scans s JOIN projects p ON p.id=s.project_id ORDER BY s.id DESC LIMIT 10''').fetchall()]
    return page(request,'index.html',projects=projects,recent=recent,workspace=workspace_stats(),ollama=ollama_health(),
                error=request.query_params.get('error','')[:200])

@app.post('/projects')
def create_project(request:Request, domain:str=Form(''), label:str=Form(''),
                   csrf_token:str=Form('')):
    auth(request); validate_csrf(request, csrf_token)
    # The enabled collectors are strictly passive, using public sources only.
    # No ownership restriction is necessary for this public-information workflow.
    try:
        domain = canonical_domain(domain)
    except ValueError as exc:
        return go('/?error=' + quote(str(exc)))
    label = (label.strip() or domain)[:100]
    with connect() as db:
        count = db.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
        if count >= 200:
            return go('/?error=' + quote('Project limit reached (200)'))
        db.execute('INSERT OR IGNORE INTO projects (domain,label,authorized,created_at) VALUES (?,?,1,?)',
                   (domain,label,utcnow()))
        p = db.execute('SELECT id FROM projects WHERE domain=?', (domain,)).fetchone()
    audit('project_created',domain)
    return go(f'/projects/{p[0]}')

@app.get('/projects/{project_id}')
def project_page(request:Request,project_id:int):
    if request.session.get('username') != USERNAME:
        return go('/login')
    with connect() as db:
        project = db.execute('SELECT * FROM projects WHERE id=?',(project_id,)).fetchone()
        scans = [dict(x) for x in db.execute('''SELECT s.*, (SELECT COUNT(*) FROM findings f WHERE f.scan_id=s.id) AS findings
        FROM scans s WHERE project_id=? ORDER BY id DESC LIMIT 30''',(project_id,)).fetchall()]
    if not project:
        raise HTTPException(404)
    return page(request,'project.html',project=dict(project), scans=scans,
                tools={n: True if n in ('dns','ct') else bool(__import__('shutil').which({'whois':'whois','harvester':'theHarvester','amass':'amass'}[n])) for n in COLLECTORS},
                error=request.query_params.get('error','')[:200])

@app.post('/projects/{project_id}/scan')
async def start_scan(request:Request, project_id:int):
    auth(request)
    form = await request.form()
    validate_csrf(request, str(form.get('csrf_token','')))
    options = [x for x in form.getlist('collectors') if x in COLLECTORS]
    # Bound the options list and require at least one real data source.
    options = list(dict.fromkeys(options))[:5]
    if not options:
        return go(f'/projects/{project_id}?error=' + quote('اختر مصدراً واحداً على الأقل'))
    with connect() as db:
        project = db.execute('SELECT * FROM projects WHERE id=?',(project_id,)).fetchone()
        if project is None or not project['authorized']:
            raise HTTPException(403,'Project not enabled for public OSINT')
        active = db.execute("SELECT COUNT(*) FROM scans WHERE status IN ('queued','running')").fetchone()[0]
        if active >= 2:
            return go(f'/projects/{project_id}?error=' + quote('هناك فحصان قيد التنفيذ. أعد المحاولة بعد انتهائهما.'))
        cursor = db.execute('''INSERT INTO scans (project_id,status,created_at,options_json)
                VALUES (?,?,?,?)''',(project_id,'queued',utcnow(),json.dumps(options)))
        sid = cursor.lastrowid
        domain = project['domain']
    audit('scan_created', f'{sid}: {domain} {",".join(options)}')
    request.app.state.executor.submit(run_scan,sid,domain,options)
    return go(f'/scans/{sid}')

@app.get('/scans/{scan_id}')
def scan_page(request:Request,scan_id:int):
    if request.session.get('username') != USERNAME:
        return go('/login')
    scan = get_scan(scan_id)
    data = report_data(scan_id)
    return page(request,'scan.html',scan=scan,findings=data['findings'],report=data['report'],
                summary=data['summary'],stats=data['stats'],sources=data['sources'],
                observations=data['observations'],diff=data['diff'],fingerprint=data['fingerprint'])

@app.get('/api/scans/{scan_id}/status')
def scan_status(request:Request,scan_id:int):
    auth(request)
    scan = get_scan(scan_id)
    data = report_data(scan_id)
    return {'scan':scan['status'], 'findings':len(data['findings']),
            'sources': [{'source':r['source'],'status':r['status'],'findings':r['findings']} for r in data['sources']],
            'report':data['report']['status'] if data['report'] else 'absent',
            'error':scan['error'], 'report_error':data['report']['error'] if data['report'] else ''}

@app.post('/scans/{scan_id}/analyze')
def analyze(request:Request,scan_id:int,csrf_token:str=Form('')):
    auth(request); validate_csrf(request,csrf_token)
    scan = get_scan(scan_id)
    if scan['status'] != 'done':
        raise HTTPException(409,'Scan must finish before analysis')
    with connect() as db:
        current = db.execute('SELECT * FROM reports WHERE scan_id=?',(scan_id,)).fetchone()
        if current and current['status'] in ('queued','running'):
            return go(f'/scans/{scan_id}')
        if current:
            db.execute("UPDATE reports SET status='queued', error='', updated_at=? WHERE scan_id=?",(utcnow(),scan_id))
        else:
            db.execute("INSERT INTO reports(scan_id,status,created_at,updated_at) VALUES (?,'queued',?,?)",
                       (scan_id,utcnow(),utcnow()))
    audit('analysis_created',f'{scan_id}, model={model_name()}')
    request.app.state.executor.submit(analyze_local,scan_id)
    return go(f'/scans/{scan_id}')

@app.get('/reports/{scan_id}')
def report_page(request:Request,scan_id:int):
    if request.session.get('username') != USERNAME:
        return go('/login')
    get_scan(scan_id)
    data = report_data(scan_id)
    return page(request,'report.html',data=data)

@app.get('/reports/{scan_id}/download')
def report_export(request:Request,scan_id:int,format:str='html'):
    auth(request)
    if format not in ('html','md','json','csv'):
        raise HTTPException(400,'Unsupported format')
    get_scan(scan_id)
    data = report_data(scan_id)
    if format == 'html':
        body = to_html(data); media='text/html; charset=utf-8'
    elif format == 'md':
        body = to_markdown(data); media='text/markdown; charset=utf-8'
    elif format == 'json':
        body = json.dumps(data,ensure_ascii=False,indent=2); media='application/json; charset=utf-8'
    else:
        body = to_csv(data); media='text/csv; charset=utf-8'
    return Response(body,media_type=media,headers={
        'Content-Disposition':f'attachment; filename="star-osint-scan-{scan_id}.{format}"',
        'X-Content-Type-Options':'nosniff'})

@app.get('/insights')
def insights_page(request: Request):
    if request.session.get('username') != USERNAME:
        return go('/login')
    return page(request, 'insights.html', stats=workspace_stats(), ollama=ollama_health())

@app.get('/api/insights')
def insights_api(request: Request):
    auth(request)
    return workspace_stats()

@app.get('/scans/{scan_id}/compare')
def scan_compare_page(request: Request, scan_id: int):
    if request.session.get('username') != USERNAME:
        return go('/login')
    scan = get_scan(scan_id)
    return page(request, 'compare.html', scan=scan, diff=compare_snapshots(scan_id))
