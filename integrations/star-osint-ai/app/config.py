import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')

def db_path():
    configured = Path(os.getenv('APP_DB_PATH', './data/osint.db'))
    return configured if configured.is_absolute() else ROOT / configured

def reports_path():
    return ROOT / 'reports'

def model_name():
    return os.getenv('OLLAMA_MODEL', 'qwen2.5:7b')

def security_config():
    secret = os.getenv('APP_SESSION_SECRET', '')
    password_hash = os.getenv('APP_PASSWORD_HASH', '')
    if len(secret) < 40 or not password_hash.startswith('pbkdf2_sha256$'):
        raise RuntimeError('Missing .env credentials. Run: python scripts/create_admin.py')
    return secret, os.getenv('APP_USERNAME', 'admin'), password_hash
