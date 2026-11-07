#!/bin/sh
# Star-iSH: local-only SSH for connecting from Moshi on the same iPhone.
# Runs inside iSH (Alpine Linux), not in Windows PowerShell.
set -eu

if [ "$(id -u)" != "0" ]; then
    echo 'ERROR: Run this script as root inside iSH.' >&2
    exit 1
fi

printf '\n[1/5] Installing OpenSSH on Alpine...\n'
apk add --no-cache openssh

printf '\n[2/5] Preparing a non-root SSH user...\n'
if ! id star >/dev/null 2>&1; then
    adduser -D -s /bin/ash star
fi
printf 'Choose a NEW password for the local star user. Do not share it in chat.\n'
passwd star

printf '\n[3/5] Generating server host keys...\n'
ssh-keygen -A
mkdir -p /run/sshd

printf '\n[4/5] Validating SSH configuration...\n'
/usr/sbin/sshd -t

printf '\n[5/5] Starting local-only SSH on 127.0.0.1:2222...\n'
if /usr/sbin/sshd -p 2222 \
  -o ListenAddress=127.0.0.1 \
  -o PermitRootLogin=no \
  -o PasswordAuthentication=yes \
  -o PubkeyAuthentication=yes \
  -o UsePAM=no; then
    echo 'SSH start command completed.'
else
    echo 'Could not start SSH. Check whether port 2222 is already in use.' >&2
    exit 1
fi

cat <<'MSG'

Moshi settings:
  Name: Star-iSH
  Host: 127.0.0.1
  Port: 2222
  Username: star
  Authentication: Password (the one you just created)
  Connection: SSH

Test from iSH (optional):
  ssh -p 2222 star@127.0.0.1

Important:
  - This connects only to iSH on the iPhone, NOT your Windows PC.
  - Keep iSH running; iOS may suspend the SSH server in the background.
  - Only connect to hosts you own or have permission to administer.
MSG