# Insta Mockup Constitution

<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles: Frontend-as-contract (now enforces style consistency)
- Added sections: none
- Removed sections: none
- Templates requiring updates: ✅ .specify/templates/plan-template.md, ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: none
-->

## Core Principles

### I. TDD-first backend delivery (non-negotiable)
Backend work MUST start with failing tests and follow red-green-refactor. Use `backend/tests` with pytest to lock behavior before writing code; add docstrings that explain intent, not restate names. Quality gates (ruff format, pyright type checks, pytest) must pass locally before asking for review.

### II. Frontend-as-contract
Do not change basic functionality. The existing frontend is the behavioral and visual source of truth: payloads stay camelCase, session cookies are always sent, and routes/redirects must keep working. Any backend change must preserve those flows or include matching frontend updates. Any new frontend element MUST follow the existing app’s design system and styling conventions (shared components, layout patterns, spacing, and color tokens) instead of introducing ad-hoc styles.

### III. Authenticated access and ownership enforcement
All backend routes MUST require authenticated access via JWT Bearer token for researcher configuration (projects, experiments, media, accounts, results); no anonymous endpoints for those. Participant-facing endpoints (public feed delivery, interaction logging, session resume) are scoped exceptions: they are link-gated via experiment `public_url` token and do not require researcher authentication. Mutations on researcher resources must verify researcher ownership using the existing helpers (projects/experiments/videos/comments/accounts).

### IV. Media safety and ingest discipline
Uploads MUST respect validator rules (50MB max; jpg/jpeg/png/gif/mp4/mov/webm only) and write to `UPLOAD_DIR`, exposed via `/media` when present. RocketAPI ingest requires `ROCKET_API_KEY`; keep downloads and proxies confined to backend-managed storage and avoid bypassing validator safeguards.

### V. Ordering and data integrity
Positions define ordering for videos and preseeded comments; create and reorder operations must maintain contiguous ordering and honor locks. Randomization seeds, `public_url` tokens, and query-key semantics must remain stable to keep public feeds and dashboards predictable.

## Operational Constraints

- Environment: `ROCKET_API_KEY` must be set to import the backend; `DATABASE_URL`, `UPLOAD_DIR`, `BASE_URL`, and `SESSION_SECRET` are optional overrides.
- Auth/session: FastAPI OAuth2 Bearer tokens via JWT; all client requests must include `Authorization: Bearer <token>` header. Backend routes must reject unauthenticated access.
- Storage: Local uploads live under `uploads/` by default; served at `/media` when the directory exists. Keep write paths within `UPLOAD_DIR`.
- Default data: No implicit user seeding. Tests use explicit fixtures to create users as needed; all production users must explicitly register.

## Development Workflow & Quality Gates

- Write backend tests first (pytest) for any behavior change, then implement, then refactor.
- Run ruff (format + lint), pyright, and pytest before completion; fixes must land before review.
- Keep API shapes camelCase (via `CamelModel`) and preserve authentication + ownership checks on every route.
- Follow existing router patterns (FastAPI + SQLModel sessions) and reuse helpers instead of duplicating logic.
- Document non-obvious logic with concise docstrings; avoid redundant comments.
 - On the frontend, prefer existing shared components and utility classes; new UI MUST visually align with the current app and avoid bespoke styling unless the design system is explicitly extended.

## Governance

- This constitution overrides other project practices. Amend via PR with an updated Sync Impact Report and semantic version bump.
- Versioning: semantic (MAJOR incompatibility to principles/sections; MINOR new principle/section; PATCH clarifications).
- Compliance: reviewers must verify TDD evidence, quality gates (ruff, pyright, pytest), session/ownership enforcement, and media safety adherence.
- Runtime guidance: prefer existing frontend behavior and backend router patterns when uncertain; deviations require documented rationale in the PR.

**Version**: 1.2.0 | **Ratified**: 2025-12-21 | **Last Amended**: 2025-12-21
