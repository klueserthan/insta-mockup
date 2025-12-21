## Description

<!-- Provide a clear and concise description of your changes -->

## Related Tasks

<!-- Link to tasks from specs/001-instagram-mockup-feed/tasks.md -->

- Addresses task: <!-- e.g., T1.1, T2.3 -->
- Relates to user story: <!-- e.g., US1, US2 -->

## Type of Change

<!-- Mark with an 'x' all that apply -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)

## Pre-Commit Checklist

Before requesting review, I have:

### Branch & Base
- [ ] Created this branch from `001-instagram-mockup-feed` (NOT from `main`)
- [ ] Set PR base to `r001-instagram-mockup-feed` (verified below title)

### Backend Code Quality (run from backend/)
- [ ] `bash .github/scripts/backend-prechecks.sh` (runs: `uv sync --group dev`, `pyright .`, `ruff format .`, `ruff check --fix .`, `uv run pytest`)

### Testing
- [ ] Frontend changes: `cd frontend && npm test`
- [ ] Added/updated tests for new functionality (if applicable)
- [ ] Tests follow TDD principles (written before implementation)
- [ ] Code coverage maintained or improved

### Documentation & Specs
- [ ] Consulted relevant specs in `specs/001-instagram-mockup-feed/` before implementing
- [ ] Updated docstrings for new/modified public APIs
- [ ] Updated README or frontend docs if user-facing behavior changed
- [ ] Followed design decisions documented in `specs/001-instagram-mockup-feed/research.md`

### CI & Constitution
- [ ] Verified CI is green on this PR
- [ ] Followed constitution requirements (`.specify/memory/constitution.md`)
- [ ] Considered semantic versioning impact (if API changes)

## Testing Strategy

<!-- Describe how you tested your changes -->

### Unit Tests
<!-- List new or modified unit tests -->

### Integration Tests
<!-- List new or modified integration tests, if applicable -->

### Manual Testing
<!-- Describe any manual testing performed -->

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

## Additional Notes

<!-- Any additional context, screenshots, or information that reviewers should know -->

---

**Constitution Compliance**: This PR adheres to the project constitution at `.specify/memory/constitution.md`, including TDD workflow, semantic versioning, and CI quality gates.
