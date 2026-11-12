import pytest
from app.collectors import canonical_domain, belongs_to_domain, finding
from app.security import hash_password, verify_password
from app.reports import to_html, to_csv

@pytest.mark.parametrize('raw,expected', [
    ('EXAMPLE.ORG.', 'example.org'),
    ('sub.Example.org', 'sub.example.org'),
    ('münich.example', 'xn--mnich-kva.example'),
    ('https://Example.org/news?page=2', 'example.org'),
    ('http://sub.example.org:8080/robots.txt', 'sub.example.org'),
    ('sub.example.org/path?q=hello', 'sub.example.org'),
    ('*.example.org', 'example.org'),
    ('https://*.example.org/about', 'example.org'),
    ('//example.org/path', 'example.org'),
    ('https://مثال.إختبار/anything', 'xn--mgbh0fb.xn--kgbechtv'),
    ('gov.iq', 'gov.iq'),
])
def test_domain(raw,expected):
    assert canonical_domain(raw) == expected

@pytest.mark.parametrize('invalid', [
    '127.0.0.1', 'localhost', 'a.local', 'a.internal', 'a.test',
    '127.0.0.1/path', 'http://[::1]/admin', 'http://foo.com:abc',
    'https://foo.com:99999', 'ftp://example.org/path',
    'https://alice:secret@example.org', 'evil.org@127.0.0.1',
    'a..org', 'a_test.com', 'https://a_test.com/path',
    'example.org\\@evil.org', 'https://example.org\nHeader: bad',
    'http://', 'javascript:alert(1)', 'https://example.org%2f.evil.com',
    'example.org:80:99', 'https://evil.org:999999',
])
def test_reject_invalid_domains(invalid):
    with pytest.raises(ValueError):
        canonical_domain(invalid)

def test_subdomain_scope():
    assert belongs_to_domain('mail.example.org','example.org')
    assert not belongs_to_domain('mail.example.org.evil.net','example.org')
    assert not belongs_to_domain('notexample.org','example.org')

def test_password_storage():
    encrypted = hash_password('examplePass@1234')
    assert 'examplePass' not in encrypted
    assert verify_password('examplePass@1234', encrypted)
    assert not verify_password('wrong',encrypted)

def test_report_html_escaped():
    data = {'scan':{'domain':'example.org','id':1,'created_at':'now'},
      'findings':[{'id':1,'kind':'TXT','value':'<script>alert(1)</script>','source':'DNS','confidence':'high'}],
      'summary':None}
    body = to_html(data)
    assert '<script>alert(1)</script>' not in body
    assert '&lt;script&gt;' in body
    assert '\'<script>\'' not in to_csv(data)

def test_csv_formula_injection_sanitized():
    data = {'findings':[{'id':1,'kind':'TXT','value':'=cmd|x','source':'DNS','confidence':'high'}]}
    assert "'=cmd|x" in to_csv(data)
