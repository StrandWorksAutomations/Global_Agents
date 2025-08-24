# Refactor Agent Bundle
- `REFRACTOR_AGENT_SPEC.md` — full spec.
- `.refactor-agent.yaml` — config template.
- `tools/refactor/bootstrap.sh` — initialize and seed request.
- `tools/refactor/run.sh` — execute generated task graph.
- `tools/refactor/validate.sh` — run gates locally.
- `.refactor-agent/AGENT_INSTRUCTIONS.md` — AI self-launch instructions.
- `.github/workflows/refactor-ci.yml` — CI example.
- `.github/pull_request_template.md` — PR checklist.

## Quick Start
1. Drop these files at your repo root.
2. Edit `.refactor-agent.yaml`.
3. Run `./tools/refactor/bootstrap.sh`.
4. Open `.refactor-agent/AGENT_INSTRUCTIONS.md` with your AI IDE agent and let it generate `.refactor-agent/TASK_GRAPH.md`.
5. Run `./tools/refactor/run.sh`, then `./tools/refactor/validate.sh`.
6. Commit and open PRs.
