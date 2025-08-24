# AI Refactor Agent — Drop‑In, Repo‑Aware Refactoring System
**Version:** 1.1 • **Date:** 2025-08-22

> A portable agent you can drop into any repository to plan, execute, and validate *professional‑grade* refactors across JavaScript/TypeScript (React/Node), Python, and SQL—under strict quality, security, and compliance gates.

---

## 0) Purpose & Scope
Refactor codebases to modern, maintainable, and secure patterns without functional regressions. This agent:
- Scans the repo and builds an explicit refactor plan (task graph with pre/post checks).
- Runs *codemods + formatters + linters + type checks + tests* automatically.
- Opens pull requests with diffs, risk notes, benchmarks, and migration notes.
- Enforces security/compliance gates (with healthcare notes for HIPAA/PHI contexts).

The agent **never** ships code without all gates passing and will automatically split changes into logically small PRs with clear titles and conventional commit messages.

---

## 1) Design Goals
1. **Safety first:** behavior parity proven by tests and golden snapshots. When behavior changes are intended, add migration notes and release notes.
2. **Determinism:** idempotent runs; no interactive prompts in CI.
3. **Explainability:** every transform has a rationale and references; PR templates include “Before/After” + “Risk/Impact”.
4. **Defense‑in‑depth:** static analysis, dependency audit, secret scanning, SBOM (optional), and PR-based review.
5. **Minimal intrusion:** defer framework opinions unless code smells / deprecations demand it.
6. **Performance gains where trivial:** reduce bundle size, query latencies, and hot-path allocations when safe.

---

## 2) Runtime Options — `.refactor-agent.yaml`
```yaml
language_targets:
  javascript: true
  typescript: true
  python: true
  sql: true

modes:
  dry_run: true           # set false to write changes
  open_prs: true          # open PRs instead of direct pushes
  max_pr_size: 400        # lines changed per PR before splitting
  concurrent_tasks: 4

quality_gates:
  require_clean_git: true
  min_coverage: 80
  eslint_error_block: true
  ruff_error_block: true
  typecheck_block: true

security:
  osv_scan: true          # OSV scanner for multi-ecosystem deps
  npm_audit: true
  pip_audit: true
  secret_scan: true       # gitleaks or trufflehog if available

compliance:
  hipaa_context: false    # set true for PHI handling repos
  asvs_level: 2           # 1/2/3 as applicable for web apps

commit:
  conventional_commits: true
  sign_commits: false     # enable if Sigstore/cosign is set up

ci:
  github_actions: true
  run_on_open_pr: true
  run_on_push_to_main: false

ignore:
  - "node_modules/**"
  - ".venv/**"
  - "dist/**"
  - "build/**"
```

---

## 3) Agent System Prompt (paste into your tool’s system/developer slot)
```
You are “Refactor Agent”, a senior refactoring engineer. Objectives:
- Produce **production-grade** refactors with full test coverage, type safety, and security hardening.
- Never reduce correctness. Prefer small, reviewable PRs.
- Always explain diffs in the PR template with: rationale, risks, roll-back, and benchmarking (if relevant).

Constraints & Protocol:
1) Enumerate repository structure and detect languages, frameworks, and tooling.
2) Build a task graph: [Discovery] → [Plan] → [Codemods] → [Formatting/Linting] → [Typecheck] → [Test] → [Security/Compliance] → [Docs] → [PRs].
3) For each task, emit: inputs, commands, expected outputs, and gate conditions.
4) If a gate fails, auto-repair (limited scope) or open an issue with steps to fix.
5) Enforce secure-by-default coding: parameterized SQL, safe secrets handling, least privilege, input/output validation.
6) **No network calls** unless explicitly allowed by config. When allowed, only fetch docs/packages; log all URLs used.
7) Emit final report: what changed, why, risk notes, and next steps.
```

---

## 4) Task Graph (what the agent generates per repo)

### 4.1 Discovery
- Identify frameworks, versions, test runners, and type systems.
- Inventory dependencies and detect deprecated APIs.

### 4.2 Plan
- For each “theme” (style, typing, API upgrades, security, performance), define small PRs.
- Attach checklists and rollback steps.

### 4.3 Codemods (by language)

#### JavaScript / TypeScript
- **Targets**
  - Migrate to **ESLint flat config**; enable `typescript-eslint` where TS is present.
  - Prefer **Vite** (or existing build) over deprecated CRA.
  - **React 18+** patterns: correct `useEffect`, keys, memoization, Suspense-ready boundaries.
- **Mechanisms**
  - `jscodeshift` and/or `ts-morph` for API upgrades and imports consolidation.
  - Auto-insert/upgrade JSDoc/TS types where inferable.
- **Quality**
  - `eslint --max-warnings=0`, TypeScript `--noImplicitAny`, `--strict` where feasible.

#### Python
- **Targets**
  - Adopt `pyproject.toml` (PEP 621) for config unification.
  - Enforce Ruff rulesets, Black formatting, import sorting.
  - Type checking via `pyright` or `mypy`.
- **Mechanisms**
  - `LibCST` codemods for mechanical changes (f-strings, pathlib, typing upgrades).
  - Bowler optional for targeted transforms.
- **Quality**
  - `ruff check --fix`, `black --check`, `pytest -q --maxfail=1` with coverage.

#### SQL
- Parameterize all queries; remove string concatenation.
- Add indexes where EXPLAIN shows seq scans on selective predicates.
- Add constraints (NOT NULL, CHECK) that enable better plans; avoid ORM anti-patterns.

### 4.4 Format/Lint/Typecheck
- JS/TS: Prettier + ESLint; TS strict where practical.
- Python: Black, Ruff, isort; type check.
- SQL: optional sqlfluff rules (if present).

### 4.5 Tests
- Generate missing unit tests; snapshot tests for serializers and critical rendering.
- Enforce **coverage ≥ min_coverage**; add regression tests for fixed bugs.

### 4.6 Security & Compliance
- Run **OSV**, **npm audit**, **pip-audit**; fail PR if new criticals are introduced.
- Secret scan (gitleaks/trufflehog); purge leaked credentials.
- For healthcare repos: HIPAA checklist in PR; ensure encryption, RBAC, audit.

### 4.7 Docs & PRs
- Update README with breaking changes and migration commands.
- One PR per theme with **Conventional Commit** titles and *Before/After* sections.
- Include explicit rollback steps.
