#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

CONF=".refactor-agent.yaml"
REQ=".refactor-agent/REQUEST.md"
PLAN=".refactor-agent/TASK_GRAPH.md"

if [ ! -f "$CONF" ]; then
  echo "Missing $CONF"
  exit 1
fi

if [ ! -f "$PLAN" ]; then
  echo "No task graph found at $PLAN."
  echo "Open .refactor-agent/REQUEST.md with your AI IDE agent and generate $PLAN and any scripts."
  exit 1
fi

echo "==> Executing task graph"
# The task graph is markdown with code blocks. We extract runnable bash blocks.
# Your AI agent is expected to have generated fenced ```bash blocks for each step.
python - <<'PY'
import re, subprocess, sys, pathlib
plan = pathlib.Path(".refactor-agent/TASK_GRAPH.md").read_text(encoding="utf-8")
blocks = re.findall(r"```bash\n(.*?)\n```", plan, flags=re.S)
if not blocks:
    print("No bash blocks found in TASK_GRAPH.md; nothing to run.")
    sys.exit(0)
for i, block in enumerate(blocks, 1):
    print(f"\n--- Running block {i}/{len(blocks)} ---")
    print(block)
    subprocess.run(["bash", "-lc", block], check=True)
PY

echo "==> Done."
