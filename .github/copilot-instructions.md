# Copilot Instructions for insta-mockup

- **Governance (read this first)**:
  - Always obey the project constitution at `.specify/memory/constitution.md` (TDD-first backend, auth/ownership enforcement, media safety, ordering/data integrity). If a requested change would violate the constitution, surface the conflict instead of silently proceeding.
  - For the Instagram MockUp experimental reel feed feature, treat `specs/001-instagram-mockup-feed/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/openapi.yaml`, `tasks.md`) as the canonical source of requirements and behavior. Do not add or change backend/frontend behavior that contradicts those docs unless the user explicitly updates the specs.
  - When in doubt about behavior, prefer this precedence order: constitution → feature specs in `specs/001-instagram-mockup-feed/` → existing code behavior. Call out any inconsistencies you see between them.

- **How to work in this repo**:
  - Do not rely on this file for stack or API specifics; those can drift. Instead, read the current code and the feature specs under `specs/001-instagram-mockup-feed/`.
  - For backend behavior, favor the tests and routers under `backend/` plus the contracts in `specs/001-instagram-mockup-feed/contracts/openapi.yaml`.
  - For frontend behavior, favor the pages, components, and hooks under `frontend/src/` and the UX checklists in `specs/001-instagram-mockup-feed/checklists/`.
  - If you find inconsistencies between code and specs, pause and report them rather than guessing.
