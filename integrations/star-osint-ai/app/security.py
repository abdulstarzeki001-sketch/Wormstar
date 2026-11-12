import hashlib
import hmac
import secrets
import time

ITERATIONS = 600_000

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), ITERATIONS)
    return f'pbkdf2_sha256${ITERATIONS}${salt}${digest.hex()}'

def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, expected = encoded.split('$', 3)
        if algorithm != 'pbkdf2_sha256' or not (100_000 <= int(rounds) <= 2_000_000):
            return False
        actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual, bytes.fromhex(expected))
    except (ValueError, TypeError):
        return False

def new_token():
    return secrets.token_urlsafe(32)

_attempts = {}
def login_allowed(address: str) -> bool:
    now = time.monotonic()
    failures = [t for t in _attempts.get(address, []) if now - t < 900]
    _attempts[address] = failures
    return len(failures) < 8

def login_failed(address: str):
    _attempts.setdefault(address, []).append(time.monotonic())

def login_succeeded(address: str):
    _attempts.pop(address, None)
