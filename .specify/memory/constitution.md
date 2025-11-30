# Creatify Constitution

<!--
Sync Impact Report
Version: 0.0.0 → 1.0.0
Modified Principles:
- I. Spec-Driven Delivery
- II. Frontend Manager Pattern Fidelity
- III. Backend Service Contracts & Safety
- IV. Fullstack Interface Accountability
- V. Test, Observability, and Workflow Discipline
Added Sections:
- Core Principles (fully instantiated)
- Rulebook Alignment Requirements
- Development Workflow & Enforcement
Templates:
- .specify/templates/plan-template.md ✅ Constitution Check references remain valid
- .specify/templates/spec-template.md ✅ Independent story format matches Principle I
- .specify/templates/tasks-template.md ✅ Story-grouped tasks align with Principle I and V
- .specify/templates/commands/ ⚠ Missing directory; see follow-up item
Follow-up TODOs:
- TODO(COMMAND_TEMPLATES): Confirm whether command guidance files are expected; create or document the replacement location.
-->

## Core Principles

### I. Spec-Driven Delivery

Every net-new capability, including bugfixes that mutate public behavior, MUST start with a `/speckit.specify` output that flows into `/speckit.plan` and `/speckit.tasks`. Work may not enter implementation until the spec documents user stories, measurable acceptance, and Constitution Check results recorded in the plan template. This ensures architectural trade-offs are reviewed before a single file change, keeps `/specs/[###-feature-name]/` as the single source of truth, and enables stakeholders to halt work when gates fail.

### II. Frontend Manager Pattern Fidelity

Frontend efforts MUST comply with `.project-rules/frontend/index.md`, which references the Manager-pattern architecture, MVC guidelines, workflow, conventions, directory structure, and examples. UI components stay dumb (render only), all orchestration and side effects sit in Managers, and every UI task explicitly documents which mandatory rule docs were consulted. Any deviation (e.g., component directly calling APIs) is a blocker until the rulebook is satisfied or an approved exception is documented in the plan’s Constitution Check section.

### III. Backend Service Contracts & Safety

Backend changes MUST be grounded in `.project-rules/backend/index.md` (the authoritative index of server-side rules) plus the Django-specific guidance in `webserver/CLAUDE.md` and `webserver/AGENTS.md`. Contracts (serializers, Celery tasks, webhooks) require tests before rollout, schema migrations follow `python manage.py makemigrations/migrate`, and observability hooks (logging, Sentry, Datadog) are mandatory for every new execution path. Breaking changes demand semantic version justification inside specs and migration instructions in PR descriptions.

### IV. Fullstack Interface Accountability

Fullstack features span both `main-web-ui/` and `webserver/`; responsibilities MUST be carved along the `.project-rules/fullstack/index.md` guidance. Contracts between layers are defined in `/specs/.../contracts/`, and each side documents how it satisfied its respective rule index before integration. No change may merge until both sides confirm parity (e.g., API response matches frontend manager expectations) and cross-repo mocks/tests exist to assert compatibility.

### V. Test, Observability, and Workflow Discipline

All code paths require automated coverage at the tightest viable level: unit for pure logic, integration for cross-boundary behavior, and contract tests for serialized interfaces. Django services follow `ruff`, `pytest`, and Celery-mocking mandates from `webserver/CLAUDE.md`, while frontend work attaches story-driven tests per `.project-rules/frontend/index.md`. Observability (structured logs, metrics, alerting) is treated as part of the definition of done; releases that skip it are non-compliant.

## Rulebook Alignment Requirements

1. The repository maintains three authoritative rule collections:
   - Frontend: `.project-rules/frontend/` with `index.md` as the canonical reading order for architecture, MVC, workflow, convention, directory, and example docs.
   - Backend: `.project-rules/backend/` with `index.md` cataloguing all required backend standards.
   - Fullstack: `.project-rules/fullstack/` with `index.md` orchestrating how cross-surface initiatives adhere to both sides.
2. **CRITICAL: Recursive Rule Reading Protocol**. Upon identifying a task boundary (Frontend, Backend, or Fullstack), the AI **MUST** first read the corresponding `index.md` file. It is **MANDATORY** to then recursively read all "Mandatory" documents referenced within that `index.md`. Merely reading the index is insufficient; the specific rules contained in the referenced documents (e.g., architecture, conventions, workflows) must be ingested and applied. Failure to follow the deep-link references in `index.md` is a violation of this constitution.
3. These indexes MAY evolve, but the `index.md` entry point is guaranteed. Every feature spec MUST state which indexes (and downstream docs) were consulted, differentiating frontend vs. backend scope so guidance never gets conflated.
4. Optional rule documents under other directories (.local, etc.) MUST have their front-matter `description` reviewed before deciding relevance, exactly as the frontend index prescribes.

## Development Workflow & Enforcement

- `/speckit.specify` captures user stories, priorities, and acceptance tests; `/speckit.plan` adds technical context, Constitution Check outcomes, and project structure; `/speckit.tasks` decomposes execution by user story. These templates already enforce independence and provide checkpoints aligned with Principle I.
- Any Constitution Check violation MUST populate the plan template’s "Complexity Tracking" table with justification and mitigation.
- Feature folders follow the directory standards referenced by the appropriate rule index (e.g., frontend Manager directories, backend Django apps, contracts for fullstack work). Deviations require approval documented in specs and reviewed during PRs.

## Governance

1. **Supremacy**: This constitution supersedes ad-hoc preferences. If a rule conflicts with the relevant `.project-rules` index, the stricter interpretation wins until an amendment is ratified.
2. **Amendment Process**: Proposals live in a PR updating this file plus any impacted templates. Provide rationale, risk assessment, and migration guidance. Approval requires sign-off from owners of each affected rule index (frontend, backend, fullstack) and documentation of the ratification date.
3. **Versioning Policy**: Update `CONSTITUTION_VERSION` using semantic rules—MAJOR for breaking governance changes, MINOR for new principles/sections, PATCH for clarifications. Record amendments in the Sync Impact Report.
4. **Compliance Reviews**: Every `/speckit.plan` must explicitly confirm adherence to the rule indexes it touches. Code reviewers block merges lacking references to the correct index.md files or missing Constitution Check evidence. Release audits verify observability, testing, and workflow discipline before deployment.
5. **Runtime Guidance**: Developers MUST reference `webserver/CLAUDE.md` or successor runtime guides for environment setup, testing commands, and deployment steps. When new runtime instructions exist, update the constitution and relevant specs to keep guidance synchronized.

**Version**: 1.0.0 | **Ratified**: 2025-11-29 | **Last Amended**: 2025-11-29
