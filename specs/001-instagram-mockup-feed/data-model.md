# Instagram MockUp Feed - Data Model

## Overview

The Instagram MockUp Feed application uses PostgreSQL as its database with Drizzle ORM for type-safe database access. The schema is defined in `shared/schema.ts` and uses PostgreSQL-specific features including UUID generation and JSONB fields.

## Database Schema

### Researchers

User accounts for research administrators who create and manage experiments.

**Table**: `researchers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| email | text | NOT NULL, UNIQUE | Researcher's email address |
| password | text | NOT NULL | Hashed password using scrypt algorithm |
| name | text | NOT NULL | Researcher's display name |
| createdAt | timestamp | NOT NULL, default: now() | Account creation timestamp |

**Indexes**: Unique index on `email`

---

### Projects

Research projects that contain one or more experiments. Projects define global settings like query parameters, time limits, and randomization behavior.

**Table**: `projects`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| researcherId | varchar (UUID) | NOT NULL, FK to researchers.id (CASCADE) | Owner of the project |
| name | text | NOT NULL | Project name |
| queryKey | text | NOT NULL, default: 'participantId' | Query parameter key for participant identification |
| timeLimitSeconds | integer | NOT NULL, default: 300 | Time limit for experiment in seconds |
| redirectUrl | text | NOT NULL, default: '' | URL to redirect participants after completion |
| endScreenMessage | text | NOT NULL, default: 'Thank you for participating...' | Message shown on completion |
| lockAllPositions | boolean | NOT NULL, default: false | If true, disables randomization for all videos |
| randomizationSeed | integer | NOT NULL, default: 42 | Base seed for deterministic randomization |
| createdAt | timestamp | NOT NULL, default: now() | Project creation timestamp |

**Foreign Keys**: 
- `researcherId` → `researchers.id` (ON DELETE CASCADE)

**Behavior**:
- Cascading delete: Deleting a researcher deletes all their projects
- Randomization: Uses `randomizationSeed` combined with participant ID for deterministic shuffling

---

### Experiments

Individual experiments (feeds) within a project. Each experiment has a unique public URL for participant access.

**Table**: `experiments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| projectId | varchar (UUID) | NOT NULL, FK to projects.id (CASCADE) | Parent project |
| name | text | NOT NULL | Experiment name |
| publicUrl | text | NOT NULL, UNIQUE | Unique URL slug for public access |
| persistTimer | boolean | NOT NULL, default: false | If true, timer persists across page reloads |
| showUnmutePrompt | boolean | NOT NULL, default: true | If true, shows unmute prompt to participants |
| createdAt | timestamp | NOT NULL, default: now() | Experiment creation timestamp |

**Foreign Keys**:
- `projectId` → `projects.id` (ON DELETE CASCADE)

**Indexes**: Unique index on `publicUrl`

**Behavior**:
- Cascading delete: Deleting a project deletes all its experiments
- Public URL is generated as a 32-character hex string (16 random bytes)

---

### Videos

Video content within an experiment. Includes metadata for the Instagram-style interface.

**Table**: `videos`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| experimentId | varchar (UUID) | NOT NULL, FK to experiments.id (CASCADE) | Parent experiment |
| url | text | NOT NULL | Video file URL (served via object storage) |
| username | text | NOT NULL | Mock Instagram username |
| userAvatar | text | NOT NULL | Avatar URL (typically Dicebear) |
| caption | text | NOT NULL | Video caption text |
| likes | integer | NOT NULL, default: 0 | Displayed like count |
| comments | integer | NOT NULL, default: 0 | Displayed comment count |
| shares | integer | NOT NULL, default: 0 | Displayed share count |
| song | text | NOT NULL | Song/audio attribution text |
| description | text | NULL | Optional additional description |
| position | integer | NOT NULL, default: 0 | Order position in feed |
| isLocked | boolean | NOT NULL, default: false | If true, maintains position during randomization |
| createdAt | timestamp | NOT NULL, default: now() | Video creation timestamp |

**Foreign Keys**:
- `experimentId` → `experiments.id` (ON DELETE CASCADE)

**Behavior**:
- Cascading delete: Deleting an experiment deletes all its videos
- Position determines order in feed (unless randomized)
- Locked videos maintain their position even when others are shuffled
- New videos are assigned position = max(existing positions) + 1

---

### Participants

Tracks unique participants in experiments. Created on first interaction.

**Table**: `participants`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Internal unique identifier |
| experimentId | varchar (UUID) | NOT NULL, FK to experiments.id (CASCADE) | Associated experiment |
| participantId | text | NOT NULL | External participant identifier (from query param) |
| createdAt | timestamp | NOT NULL, default: now() | First interaction timestamp |

**Foreign Keys**:
- `experimentId` → `experiments.id` (ON DELETE CASCADE)

**Behavior**:
- Cascading delete: Deleting an experiment deletes all participant records
- Participant records are created automatically on first interaction
- Multiple participants can exist per experiment

---

### Interactions

Detailed logs of all participant interactions with videos.

**Table**: `interactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| participantUuid | varchar (UUID) | NOT NULL, FK to participants.id (CASCADE) | Associated participant |
| videoId | varchar (UUID) | NOT NULL, FK to videos.id (CASCADE) | Associated video |
| interactionType | text | NOT NULL | Type of interaction (view, like, comment, share, scroll) |
| metadata | jsonb | NULL | Additional interaction data (flexible JSON) |
| timestamp | timestamp | NOT NULL, default: now() | Interaction timestamp |

**Foreign Keys**:
- `participantUuid` → `participants.id` (ON DELETE CASCADE)
- `videoId` → `videos.id` (ON DELETE CASCADE)

**Behavior**:
- Cascading delete: Deleting a participant or video deletes associated interactions
- Supports extensible metadata via JSONB for future interaction types

**Common Interaction Types**:
- `view` - Video was viewed
- `like` - Video was liked
- `comment` - Comment was added
- `share` - Video was shared
- `scroll` - Scroll event occurred

---

### Preseeded Comments

Pre-populated comments that appear on videos, either manually created or AI-generated.

**Table**: `preseeded_comments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | varchar (UUID) | PRIMARY KEY, default: gen_random_uuid() | Unique identifier |
| videoId | varchar (UUID) | NOT NULL, FK to videos.id (CASCADE) | Associated video |
| authorName | text | NOT NULL | Comment author username |
| authorAvatar | text | NOT NULL | Author avatar URL |
| body | text | NOT NULL | Comment text content |
| likes | integer | NOT NULL, default: 0 | Displayed like count on comment |
| source | text | NOT NULL, default: 'manual' | Source of comment (manual, ai) |
| position | integer | NOT NULL, default: 0 | Display order position |
| createdAt | timestamp | NOT NULL, default: now() | Comment creation timestamp |

**Foreign Keys**:
- `videoId` → `videos.id` (ON DELETE CASCADE)

**Behavior**:
- Cascading delete: Deleting a video deletes all its comments
- Position determines display order
- New comments are assigned position = max(existing positions) + 1
- AI-generated comments have randomized timestamps within past 7 days

---

## Relationships

```
researchers (1) ──< (N) projects
projects (1) ──< (N) experiments
experiments (1) ──< (N) videos
experiments (1) ──< (N) participants
videos (1) ──< (N) preseeded_comments
videos (1) ──< (N) interactions
participants (1) ──< (N) interactions
```

## Data Validation

The application uses Zod schemas for runtime validation, generated from Drizzle schemas via `drizzle-zod`. Key validation schemas:

- `insertResearcherSchema` - Validates researcher creation
- `insertProjectSchema` - Validates project creation/updates
- `insertExperimentSchema` - Validates experiment creation/updates
- `insertVideoSchema` - Validates video creation/updates
- `insertParticipantSchema` - Validates participant creation
- `insertInteractionSchema` - Validates interaction logging
- `insertPreseededCommentSchema` - Validates comment creation/updates

All schemas omit auto-generated fields (id, timestamps) during insertion.

## Type Safety

The schema exports TypeScript types for both select and insert operations:

```typescript
// Select types (full records)
type Researcher = typeof researchers.$inferSelect;
type Project = typeof projects.$inferSelect;
type Experiment = typeof experiments.$inferSelect;
type Video = typeof videos.$inferSelect;
type Participant = typeof participants.$inferSelect;
type Interaction = typeof interactions.$inferSelect;
type PreseededComment = typeof preseededComments.$inferSelect;

// Insert types (validated input)
type InsertResearcher = z.infer<typeof insertResearcherSchema>;
type InsertProject = z.infer<typeof insertProjectSchema>;
type InsertExperiment = z.infer<typeof insertExperimentSchema>;
type InsertVideo = z.infer<typeof insertVideoSchema>;
type InsertParticipant = z.infer<typeof insertParticipantSchema>;
type InsertInteraction = z.infer<typeof insertInteractionSchema>;
type InsertPreseededComment = z.infer<typeof insertPreseededCommentSchema>;
```

## Randomization Algorithm

The feed randomization algorithm (implemented in `server/routes.ts`) works as follows:

1. **Seed Calculation**: Base seed + hash(participantId) = effective seed
2. **Video Separation**: Videos split into locked and unlocked groups
3. **Shuffle**: Unlocked videos shuffled using Mulberry32 PRNG with effective seed
4. **Position Assignment**:
   - Locked videos placed at their original positions (clamped to valid range)
   - Unlocked videos fill remaining slots
   - Collision resolution: locked videos shift right if slot occupied
5. **Result**: Deterministic per-participant ordering with locked positions preserved

## Migration

Database migrations are managed via Drizzle Kit:

```bash
npm run db:push
```

This command:
1. Compares schema definition with database state
2. Generates and executes SQL migrations
3. Keeps database schema in sync with code

## Notes

- All IDs use PostgreSQL's `gen_random_uuid()` for UUID generation
- Timestamps use PostgreSQL's `now()` function with timezone support
- JSONB is used for flexible metadata in interactions table
- Cascade deletion maintains referential integrity throughout the schema
- Position-based ordering enables custom sequencing with drag-and-drop UI
