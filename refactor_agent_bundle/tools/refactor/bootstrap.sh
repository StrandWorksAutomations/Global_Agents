#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "==> Detecting ecosystems"
HAS_NODE=0; [ -f package.json ] && HAS_NODE=1 || true
HAS_PY=0; [ -f pyproject.toml ] && HAS_PY=1 || true

echo "==> Loading config"
CONF=".refactor-agent.yaml"
if [ ! -f "$CONF" ]; then
  echo "Missing $CONF at repo root. Copy the template and adjust it."
  exit 1
fi

mkdir -p .refactor-agent/artifacts

echo "==> JS/TS detection"
if [ $HAS_NODE -eq 1 ]; then
  echo "JS/TS present"
  if [ ! -f "eslint.config.js" ]; then
    cat > eslint.config.js <<'EOF'
import js from "@eslint/js";
export default [js.configs.recommended];
EOF
  fi
fi

echo "==> Python detection"
if [ $HAS_PY -eq 1 ]; then
  echo "Python present"
  python - <<'PY'
from pathlib import Path
try:
    import tomllib as tomli
except Exception:
    import tomli
import tomli_w
pp = Path("pyproject.toml")
data = {}
if pp.exists():
    data = tomli.loads(pp.read_text())
data.setdefault("project", {}).setdefault("name", "app")
data.setdefault("tool", {}).setdefault("black", {})
data["tool"].setdefault("ruff", {"line-length": 100})
pp.write_text(tomli_w.dumps(data))
print("Ensured basic pyproject sections.")
PY
fi

echo "==> Seeding agent request"
cat > .refactor-agent/REQUEST.md <<'EOF'
# REFACTOR REQUEST
Please analyze this repository and emit a task graph and scripts for:
1) JS/TS codemods + ESLint flat config + TypeScript strictness where applicable.
2) Python codemods (LibCST), Black/Ruff/isort, type checks (pyright or mypy).
3) SQL lint (sqlfluff optional) and EXPLAIN plans for modified queries.
4) Tests (Vitest/Jest or pytest) and coverage thresholds.
5) Security: OSV, npm audit, pip-audit, secret scanning.
6) Docs and PR templates.

Deliverables:
- .refactor-agent/TASK_GRAPH.md
- tools/refactor/run.sh (filled with repo-specific steps)
- tools/refactor/validate.sh (gates)
- One or more PRs with Conventional Commit titles and detailed templates.
EOF

echo "Bootstrap complete. See .refactor-agent/REQUEST.md"
