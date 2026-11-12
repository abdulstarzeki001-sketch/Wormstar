#!/usr/bin/env python3
"""Create a local, live SQLite backup plus optional credentials. Never uploads data."""
from pathlib import Path
import os
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.config import db_path


def main():
    source = db_path()
    if not source.is_file():
        raise SystemExit('SQLite database not found. Start the service once first.')
    folder = ROOT / 'backups'
    folder.mkdir(mode=0o700, exist_ok=True)
    os.chmod(folder, 0o700)
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    tmp = folder / f'.database-{timestamp}.sqlite3'
    output = folder / f'star-osint-backup-{timestamp}.zip'
    # SQLite online backup API produces an internally consistent snapshot in WAL mode.
    with sqlite3.connect(source) as db, sqlite3.connect(tmp) as dst:
        db.backup(dst)
    try:
        fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, 'wb') as outfile:
            with zipfile.ZipFile(outfile, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(tmp, 'osint.db')
                env = ROOT / '.env'
                if env.is_file():
                    archive.write(env, '.env')
                archive.writestr('README.txt', 'CONFIDENTIAL BACKUP: database and admin credentials. Keep private. Do not share publicly.\n')
    finally:
        tmp.unlink(missing_ok=True)
    print(f'Backup created: {output}')
    print('CAUTION: ZIP is NOT encrypted and includes .env. Store securely.')


if __name__ == '__main__':
    main()
