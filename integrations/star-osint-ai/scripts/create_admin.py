#!/usr/bin/env python3
"""Initial local credentials creator. Password never written in plaintext."""
import getpass
import secrets
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.security import hash_password

file = ROOT / '.env'
if file.exists():
    raise SystemExit('ملف .env موجود بالفعل. تم إيقاف الإعداد حتى لا تُفقد بيانات الدخول.')
username = input('اسم مستخدم المدير [admin]: ').strip() or 'admin'
if not (3 <= len(username) <= 40 and username.replace('_','').isalnum()):
    raise SystemExit('Invalid username (3-40 alphanumeric/underscore)')
password = getpass.getpass('كلمة المرور (12 حرفاً على الأقل): ')
confirm = getpass.getpass('تأكيد كلمة المرور: ')
if password != confirm or len(password) < 12:
    raise SystemExit('يجب أن تتطابق كلمتا المرور وأن تتكونا من 12 حرفاً على الأقل')
content = '\n'.join([
 f'APP_USERNAME={username}', f'APP_PASSWORD_HASH={hash_password(password)}',
 f'APP_SESSION_SECRET={secrets.token_urlsafe(48)}',
 'APP_DB_PATH=./data/osint.db', 'OLLAMA_MODEL=qwen2.5:7b',
 'APP_HOST=127.0.0.1','APP_PORT=8787',''])
with file.open('x',encoding='utf-8') as fp:
    fp.write(content)
file.chmod(0o600)
print('تم إعداد .env، احتفظ بكلمة المرور في مدير كلمات مرور.')
