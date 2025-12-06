# InstaReel Research

## Overview

InstaReel Research is a full-stack web application designed for conducting research experiments using social media-style video feeds. The platform allows researchers to create projects, design experiments with customizable video content, and collect participant interaction data. The application mimics an Instagram/TikTok-style vertical video feed interface where researchers can track user engagement metrics such as likes, comments, shares, and viewing duration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- Built with React 18 using TypeScript and Vite as the build tool
- Client-side routing implemented with Wouter (lightweight alternative to React Router)
- State management handled through TanStack Query (React Query) for server state
- UI components built with Radix UI primitives and styled using Tailwind CSS v4
- Uses shadcn/ui component system ("new-york" style variant)

**Key Design Patterns**
- Component-based architecture with reusable UI primitives
- Protected routes pattern for authenticated pages using custom `ProtectedRoute` wrapper
- Custom hooks pattern for cross-cutting concerns (auth, mobile detection, toasts)
- Provider pattern for global state (AuthProvider, QueryClientProvider)

**Frontend Structure**
- `/client/src/pages/` - Page-level components (Login, Dashboard, ReelsFeed)
- `/client/src/components/` - Reusable UI components including the video player and comments overlay
- `/client/src/hooks/` - Custom React hooks for auth, mobile detection, and toast notifications
- `/client/src/lib/` - Utility functions and shared configuration

### Backend Architecture

**Framework & Runtime**
- Express.js server running on Node.js with TypeScript
- Session-based authentication using Passport.js with local strategy
- PostgreSQL database accessed through Drizzle ORM
- RESTful API design pattern for all endpoints

**Authentication & Authorization**
- Passport.js local strategy with bcrypt password hashing using scrypt algorithm
- Express session middleware with PostgreSQL session store (connect-pg-simple)
- Session secret configurable via environment variable
- Middleware-based route protection with `requireAuth` function

**API Architecture**
- Resource-oriented endpoints following REST conventions:
  - `/api/projects` - CRUD operations for research projects
  - `/api/experiments` - Experiment management within projects
  - `/api/videos` - Video content management with drag-and-drop reordering
  - `/api/participants` - Participant tracking and management
  - `/api/interactions` - Interaction data collection
  - `/api/feed/:publicUrl` - Public-facing feed for participants
  - `/api/auth` - Login, logout, and registration endpoints

**Server Structure**
- `/server/routes.ts` - API endpoint definitions and route handlers
- `/server/auth.ts` - Authentication configuration and strategies
- `/server/storage.ts` - Data access layer abstracting database operations
- `/server/db.ts` - Database connection and Drizzle ORM setup
- `/server/static.ts` - Static file serving for production builds
- `/server/vite.ts` - Vite development server integration for HMR

### Data Storage

**Database Schema (PostgreSQL + Drizzle ORM)**
- `researchers` - User accounts for research administrators
- `projects` - Research projects with configurable settings (query parameters, time limits, redirect URLs)
- `experiments` - Individual experiments within projects with unique public URLs
- `videos` - Video content with metadata (username, avatar, caption, engagement metrics, position)
- `participants` - Participant tracking linked to experiments
- `interactions` - Detailed interaction logs (views, likes, comments, shares, scroll events) with timestamps

**Key Design Decisions**
- UUID primary keys for all tables using PostgreSQL's `gen_random_uuid()`
- Cascade deletion for maintaining referential integrity
- Position-based ordering for videos enabling custom sequencing
- Flexible query parameter configuration per project (e.g., `participantId`, custom keys)
- JSONB fields for extensible metadata where needed

**ORM Choice Rationale**
- Drizzle ORM chosen for type-safety and PostgreSQL-specific features
- Schema-first approach with Zod validation integration
- Supports migrations through drizzle-kit

### Build & Deployment

**Development Mode**
- Vite dev server with HMR running on port 5000
- Express server proxying to Vite for API requests
- Hot module replacement for rapid frontend development
- Replit-specific plugins for runtime error overlay and dev banner

**Production Build**
- Client built with Vite to `dist/public`
- Server bundled with esbuild to `dist/index.cjs`
- Server dependencies bundled (allowlist approach) to reduce syscalls and improve cold start times
- Static file serving handled by Express in production

**Environment Configuration**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Session encryption key (defaults to dev value)
- `NODE_ENV` - Environment indicator (development/production)

## External Dependencies

### UI Libraries
- **Radix UI** - Unstyled, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Tailwind CSS v4** - Utility-first CSS framework with custom design tokens
- **Lucide React** - Icon library for consistent iconography
- **Framer Motion** - Animation library for smooth interactions and transitions
- **dnd-kit** - Drag-and-drop library for video reordering functionality

### Data Management
- **TanStack Query** - Server state management with caching and automatic refetching
- **React Hook Form** - Form state management with validation
- **Zod** - Schema validation for type-safe data handling

### Backend Services
- **PostgreSQL** - Primary relational database (connection via DATABASE_URL environment variable)
- **Drizzle ORM** - Type-safe database toolkit with migration support
- **Passport.js** - Authentication middleware with local strategy
- **bcryptjs** - Password hashing for secure credential storage

### Development Tools
- **Vite** - Fast build tool and dev server with HMR support
- **TypeScript** - Type safety across the entire stack
- **ESBuild** - Fast JavaScript bundler for server-side code
- **Replit Plugins** - Development experience enhancements (cartographer, dev banner, error modal)

### Session Management
- **express-session** - Session middleware for Express
- **connect-pg-simple** - PostgreSQL session store for persistent sessions across restarts

### Fonts & Assets
- **Google Fonts** - Inter and Roboto font families
- **Dicebear Avatars** - Dynamic avatar generation for mock users