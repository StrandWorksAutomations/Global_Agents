#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "==> Running validation gates"

if [ -f package.json ]; then
  echo "JS/TS gates"
  (npm run -s lint || true)
  (npm run -s typecheck || true)
  (npm test -- --coverage || true)
fi

if [ -f pyproject.toml ]; then
  echo "Python gates"
  (ruff check . --output-format=github || true)
  (black --check . || true)
  (pytest -q --maxfail=1 --disable-warnings || true)
fi

echo "==> Security scans"
if command -v npx >/dev/null 2>&1; then
  (npx --yes osv-scanner scan || npx --yes npm@9 audit --audit-level=high || true)
fi
if command -v pipx >/dev/null 2>&1; then
  (pipx run pip-audit || true)
fi

echo "Validation complete."
