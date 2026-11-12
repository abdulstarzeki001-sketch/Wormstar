import os
import secrets
import tempfile
from pathlib import Path

# Set test configuration before importing app.main.
TEST_DB = Path(tempfile.mkdtemp(prefix='star-osint-test-')) / 'tests.sqlite3'
os.environ['APP_SESSION_SECRET'] = secrets.token_urlsafe(48)
os.environ['APP_USERNAME'] = 'tester'
os.environ['APP_DB_PATH'] = str(TEST_DB)
os.environ['APP_PASSWORD_HASH'] = 'pbkdf2_sha256$100000$00112233445566778899aabbccddeeff$' + __import__('hashlib').pbkdf2_hmac('sha256',b'goodpassword123',bytes.fromhex('00112233445566778899aabbccddeeff'),100000).hex()
