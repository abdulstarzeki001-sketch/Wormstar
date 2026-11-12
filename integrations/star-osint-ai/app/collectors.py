"""Scoped, passive-only domain OSINT collectors. No arbitrary shell commands."""
import json
import re
import shutil
import subprocess
from urllib.parse import quote, urlsplit
import ipaddress
import httpx
import dns.resolver
from .db import connect, utcnow

DNS_TYPES = ('A', 'AAAA', 'MX', 'NS', 'TXT', 'CAA')
DOMAIN_LABEL = re.compile(r'^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')

def canonical_domain(value: str) -> str:
    """Accept any public DNS domain, IDN, wildcard, or http(s) URL.

    Normalize input to a DNS hostname only: collectors never visit the input URL.
    A URL's scheme, path, query, fragment and port are ignored after validation.
    Local/special-use names and literal IP addresses are not OSINT domain targets.
    """
    raw = value.strip()
    if not raw or len(raw) > 2048:
        raise ValueError('Enter a public domain or HTTP(S) URL (max 2048 characters)')
    # URL parsers disagree about controls/backslashes; reject ambiguous inputs early.
    if any(ord(char) < 32 or ord(char) == 127 for char in raw) or "\\" in raw:
        raise ValueError('Invalid domain or URL characters')

    try:
        if raw.startswith('//'):
            parsed = urlsplit('https:' + raw)
        elif '://' in raw:
            parsed = urlsplit(raw)
        else:
            parsed = urlsplit('https://' + raw)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            raise ValueError('Only public DNS domains and HTTP(S) URLs are supported')
        if '@' in parsed.netloc or parsed.username is not None or parsed.password is not None:
            raise ValueError('Do not include URL login credentials')
        # Ensure malformed ports (e.g. :abc or :99999) are not silently ignored.
        _ = parsed.port
        host = (parsed.hostname or '').lower().rstrip('.')
    except ValueError as exc:
        raise ValueError('Invalid domain or URL format') from exc

    if host.startswith('*.'):
        host = host[2:]
    if '%' in host or not host:
        raise ValueError('Invalid domain characters')
    try:
        ascii_value = host.encode('idna').decode('ascii')
    except UnicodeError as exc:
        raise ValueError('Domain encoding is invalid') from exc
    labels = ascii_value.split('.')
    if not (3 <= len(ascii_value) <= 253 and len(labels) >= 2):
        raise ValueError('Enter a public DNS domain, e.g. example.org')
    if not all(DOMAIN_LABEL.fullmatch(x) for x in labels):
        raise ValueError('Invalid domain characters')
    # IPv4, IPv6, private network and reserved internal hostnames are excluded.
    try:
        ipaddress.ip_address(ascii_value)
    except ValueError:
        pass
    else:
        raise ValueError('Enter a domain, not an IP address')
    if labels[-1].isdigit() or labels[-1] in {
        'local', 'localhost', 'internal', 'test', 'invalid', 'onion'
    } or ascii_value.endswith('.home.arpa'):
        raise ValueError('Only public DNS domains are supported')
    return ascii_value

def belongs_to_domain(name, domain):
    candidate = name.lower().strip().rstrip('.').removeprefix('*.')
    return candidate == domain or candidate.endswith('.' + domain)

def finding(kind, value, source, confidence='medium', **detail):
    return {'kind': kind, 'value': str(value)[:1000], 'source': source,
            'confidence': confidence, 'detail': detail}

def dns_findings(domain):
    out = []
    resolver = dns.resolver.Resolver()
    resolver.timeout = 2.0
    resolver.lifetime = 6.0
    for qname, record_type in [(domain, t) for t in DNS_TYPES] + [('_dmarc.'+domain, 'TXT')]:
        try:
            response = resolver.resolve(qname, record_type, raise_on_no_answer=False)
            for answer in list(response)[:30]:
                record = answer.to_text().strip()
                if record_type == 'TXT':
                    record = record.replace('" "', '').strip('"')
                if not record:
                    continue
                out.append(finding('DMARC' if qname.startswith('_dmarc.') else record_type,
                                   record, 'DNS', 'high', query=qname, ttl=response.rrset.ttl if response.rrset else None))
        except (dns.resolver.DNSException, OSError):
            continue
    return out

def ct_findings(domain):
    # CT logs are external public sources. A failed endpoint does not block other collectors.
    url = 'https://crt.sh/?q=' + quote('%.' + domain, safe='') + '&output=json'
    try:
        with httpx.Client(timeout=15, follow_redirects=False, trust_env=False) as client:
            response = client.get(url, headers={'User-Agent': 'STAR-OSINT-AI/1.0'})
            response.raise_for_status()
            if len(response.content) > 4_000_000:
                return []
            rows = response.json()
        if not isinstance(rows, list):
            return []
        seen = set()
        out = []
        for entry in rows[:1200]:
            if not isinstance(entry, dict):
                continue
            for raw in str(entry.get('name_value', '')).splitlines():
                candidate = raw.lower().strip().removeprefix('*.').rstrip('.')
                if belongs_to_domain(candidate, domain) and candidate not in seen and len(candidate) <= 253:
                    seen.add(candidate)
                    out.append(finding('subdomain', candidate, 'crt.sh', 'medium',
                                       certificate_id=str(entry.get('id',''))[:50]))
            if len(out) >= 350:
                break
        return out
    except (httpx.HTTPError, ValueError, TypeError):
        return []

def whois_findings(domain):
    if not shutil.which('whois'):
        return []
    try:
        cp = subprocess.run(['whois', domain], capture_output=True, text=True, timeout=20, check=False)
        data = cp.stdout[:30000]
        # No raw WHOIS storage: exclude contact names/emails/private details.
        fields = {'Registrar': r'(?im)^Registrar:\s*(.+)$',
                  'Creation date': r'(?im)^(?:Creation Date|Created On):\s*(.+)$',
                  'Expiration date': r'(?im)^(?:Registry Expiry Date|Expiration Date|Expiry Date):\s*(.+)$',
                  'Updated date': r'(?im)^Updated Date:\s*(.+)$'}
        out = []
        for key, regex in fields.items():
            m = re.search(regex, data)
            if m:
                out.append(finding('whois', f'{key}: {m.group(1).strip()[:150]}', 'whois', 'medium'))
        return out
    except (subprocess.TimeoutExpired, OSError):
        return []

def _run_tool(command, timeout):
    # Fixed argument list from app code; never pass user input through shell.
    try:
        p = subprocess.run(command, text=True, capture_output=True, timeout=timeout,
                           check=False, env={'PATH':'/usr/local/bin:/usr/bin:/bin', 'HOME':'/tmp'}, cwd='/tmp')
        return (p.stdout + '\n' + p.stderr)[:150000]
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ''

def harvester_findings(domain):
    if not shutil.which('theHarvester'):
        return []
    text = _run_tool(['theHarvester','-d',domain,'-b','crtsh','-l','100'], 65)
    matches = re.findall(r'(?i)(?<![\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,63}(?![\w.-])', text)
    names = sorted({x.lower() for x in matches if belongs_to_domain(x, domain)})[:200]
    return [finding('subdomain', name, 'theHarvester/crtsh', 'medium') for name in names]

def amass_findings(domain):
    if not shutil.which('amass'):
        return []
    text = _run_tool(['amass','enum','-passive','-d',domain,'-timeout','1'], 75)
    names = set()
    for line in text.splitlines():
        name = line.strip().lower().rstrip('.')
        if len(name) <= 253 and belongs_to_domain(name, domain) and re.fullmatch(r'[a-z0-9.-]+', name):
            names.add(name)
    return [finding('subdomain', name, 'amass/passive', 'medium') for name in sorted(names)[:200]]

COLLECTORS = {'dns': dns_findings, 'ct': ct_findings,
              'whois': whois_findings, 'harvester': harvester_findings, 'amass': amass_findings}

def save_findings(scan_id, records):
    with connect() as db:
        before = db.execute('SELECT COUNT(*) FROM findings WHERE scan_id=?', (scan_id,)).fetchone()[0]
        for f in records[:500]:
            db.execute('''INSERT OR IGNORE INTO findings
             (scan_id,kind,value,source,confidence,detail_json,collected_at)
             VALUES (?,?,?,?,?,?,?)''', (scan_id, f['kind'], f['value'], f['source'],
             f['confidence'], json.dumps(f.get('detail', {}), ensure_ascii=False), utcnow()))
        after = db.execute('SELECT COUNT(*) FROM findings WHERE scan_id=?', (scan_id,)).fetchone()[0]
        return after - before

def run_scan(scan_id, domain, options):
    """Run bounded passive collectors, keeping per-source progress and errors."""
    with connect() as db:
        db.execute("UPDATE scans SET status='running', started_at=? WHERE id=?", (utcnow(), scan_id))
        for name in options:
            if name in COLLECTORS:
                db.execute("""INSERT OR IGNORE INTO scan_sources(scan_id,source,status)
                          VALUES (?,?,'queued')""", (scan_id,name))
    errors = []
    try:
        for name in options:
            if name not in COLLECTORS:
                continue
            with connect() as db:
                db.execute("UPDATE scan_sources SET status='running',started_at=? WHERE scan_id=? AND source=?",
                           (utcnow(),scan_id,name))
            try:
                records = COLLECTORS[name](domain)
                count = save_findings(scan_id, records)
                with connect() as db:
                    db.execute("""UPDATE scan_sources SET status='done',findings=?,finished_at=?
                               WHERE scan_id=? AND source=?""",(count,utcnow(),scan_id,name))
            except Exception as exc:
                err = f'{type(exc).__name__}: {str(exc)[:120]}'
                errors.append(f'{name}: {type(exc).__name__}')
                with connect() as db:
                    db.execute("""UPDATE scan_sources SET status='failed',error=?,finished_at=?
                               WHERE scan_id=? AND source=?""",(err,utcnow(),scan_id,name))
        with connect() as db:
            db.execute("UPDATE scans SET status='done', finished_at=?, error=? WHERE id=?",
                       (utcnow(), '; '.join(errors), scan_id))
    except Exception as exc:
        with connect() as db:
            db.execute("UPDATE scans SET status='failed', finished_at=?, error=? WHERE id=?",
                       (utcnow(), f'{type(exc).__name__}: {str(exc)[:180]}', scan_id))
