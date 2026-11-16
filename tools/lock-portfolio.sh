#!/bin/sh
# Re-lock the portfolio after editing its source.
#
#   tools/lock-portfolio.sh            (asks for the password)
#   tools/lock-portfolio.sh '<password>'
#
# Source:  _src/portfolio/index.html   (gitignored, never published; paths are
#          relative to /portfolio/, so images are ../work/…, styles ../folio.css)
# Output:  portfolio/portfolio.lock.json (commit and push this)
# The password is in docs/CREDENTIALS.md. A new password works as soon as the
# new lock file is live; visitors already unlocked are asked again.
set -e
cd "$(dirname "$0")/.."
SRC=_src/portfolio/index.html
OUT=portfolio/portfolio.lock.json
[ -f "$SRC" ] || { echo "missing $SRC (the plaintext portfolio lives only on Ola's computer)"; exit 1; }
PASS="$1"
if [ -z "$PASS" ]; then
  printf 'portfolio password: '; stty -echo; read -r PASS; stty echo; echo
fi
node desktop/tools/lock.mjs "$SRC" "$OUT" "$PASS"
# Safety check: a phrase from the page (her favourite film, split so this file
# doesn't contain it) must not appear in any tracked or staged file.
PHRASE="Donnie"" Darko"
if git grep -q -I "$PHRASE" -- . 2>/dev/null || git grep --cached -q -I "$PHRASE" -- . 2>/dev/null; then
  echo "WARNING: portfolio text found in a tracked file:"; git grep -l "$PHRASE" -- .; exit 1
fi
echo "done. now: git add $OUT && git commit -m 'Portfolio: update' && git push"
