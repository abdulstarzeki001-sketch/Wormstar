#!/bin/sh
# Imports user-owned OneDrive files from a local folder into a private GitHub repo.
# Does not contact any customs/government servers or run archived scripts.
set -eu

usage() {
  echo "Usage: sh tools/ish/upload_onedrive_archive_private.sh LOCAL_FOLDER [OWNER/PRIVATE_REPO]" >&2
  exit 2
}
[ "$#" -ge 1 ] && [ "$#" -le 2 ] || usage
SOURCE="$1"
DEST="abdulstarzeki001-sketch/Star-Cyber-Audit-Private-Archive"
if [ "$#" -eq 2 ]; then DEST="$2"; fi
case "$DEST" in
  */*) ;;
  *) usage ;;
esac
case "$DEST" in
  *[!a-zA-Z0-9._/-]*|*//*|*/../*|*/./*)
    echo "Invalid destination" >&2; exit 2 ;;
esac

for dep in git gh mktemp find cp; do
  command -v "$dep" >/dev/null 2>&1 || { echo "Missing command: $dep" >&2; exit 3; }
done
[ -d "$SOURCE" ] || { echo "Source folder not found" >&2; exit 3; }
SOURCE="$(CDPATH= cd "$SOURCE" && pwd -P)"
[ -n "$(find "$SOURCE" -type f -print -quit)" ] || {
  echo "No files in source folder" >&2; exit 3;
}
if [ -n "$(find "$SOURCE" -type l -print -quit)" ]; then
  echo "Refusing to archive source with symlinks" >&2; exit 3
fi
COUNT="$(find "$SOURCE" -type f | wc -l | tr -d ' ')"
[ "$COUNT" -le 200 ] || {
  echo "More than 200 files; select the intended OneDrive folder" >&2; exit 3
}
[ -z "$(find "$SOURCE" -type f -size +90M -print -quit)" ] || {
  echo "File over 90 MB; cannot upload with this tool" >&2; exit 3
}

gh auth status >/dev/null 2>&1 || {
  echo "Sign in to GitHub first: gh auth login" >&2; exit 4
}
if ! gh repo view "$DEST" --json isPrivate --jq '.isPrivate' >/dev/null 2>&1; then
  echo "Creating PRIVATE GitHub repository"
  gh repo create "$DEST" --private --add-readme --description "Private OneDrive source archive"
fi
[ "$(gh repo view "$DEST" --json isPrivate --jq '.isPrivate')" = "true" ] || {
  echo "REFUSED: destination repository is NOT private" >&2; exit 5
}

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT HUP INT TERM
gh auth setup-git >/dev/null 2>&1
git clone -q "https://github.com/$DEST.git" "$TEMP_DIR/repo"
mkdir -p "$TEMP_DIR/repo/archives/onedrive-uboor"
cp -R "$SOURCE"/. "$TEMP_DIR/repo/archives/onedrive-uboor/"
cd "$TEMP_DIR/repo"
cat > ARCHIVE_NOTICE.md <<'NOTICE'
# PRIVATE archival storage only

Original files were supplied by the owner and may contain personal information,
opaque QR URLs or third-party intellectual property. These snapshots are NOT
an official government service and should not be publicly deployed.
NOTICE
git add -- archives/onedrive-uboor ARCHIVE_NOTICE.md
if git diff --cached --quiet; then
  echo "Already archived; no new changes"
  exit 0
fi
git -c user.name="Star Private Archive" -c user.email="star-private-archive@users.noreply.github.com" \
  commit -qm "Archive OneDrive originals in private repository"
[ "$(gh repo view "$DEST" --json isPrivate --jq '.isPrivate')" = "true" ] || {
  echo "REFUSED: repository is no longer private" >&2; exit 5
}
git push -q origin HEAD
echo "Private archive uploaded: https://github.com/$DEST"
echo "Original source files archived: $COUNT"
