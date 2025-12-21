# Instagram MockUp Feed - Phase 1 Tasks

## Scope
Validate quickstart and core docs for the Instagram MockUp experimental reel feed feature.
Confirm that API contracts and data model docs match the current implementation surface.

## Tasks

### T001: Confirm quickstart steps
**Status**: ✅ Complete  
**File**: `specs/001-instagram-mockup-feed/quickstart.md`  
**Description**: Document the correct steps to set up and run the Instagram MockUp feed application.

### T002: Confirm API contract scope [P]
**Status**: ✅ Complete  
**Priority**: High  
**File**: `specs/001-instagram-mockup-feed/contracts/openapi.yaml`  
**Description**: Document all API endpoints and their contracts to match the implementation surface in `server/routes.ts`.

### T003: Confirm data model [P]
**Status**: ✅ Complete  
**Priority**: High  
**File**: `specs/001-instagram-mockup-feed/data-model.md`  
**Description**: Document the data model to align with current database schema in `shared/schema.ts`.

## Notes
- Follow the constitution TDD rules for any backend behavior changes uncovered by this validation.
- Prefer updating specs/contracts first if you discover mismatches, then code, to keep artifacts aligned.
- This is a TypeScript/Node.js project, not Python. Backend models are in `shared/schema.ts`.
