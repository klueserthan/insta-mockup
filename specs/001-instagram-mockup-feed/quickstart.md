# Instagram MockUp Feed - Quickstart Guide

## Overview

InstaReel Research is a full-stack web application for conducting research experiments using social media-style video feeds. The platform allows researchers to create projects, design experiments with customizable video content, and collect participant interaction data through an Instagram/TikTok-style vertical video feed interface.

## Prerequisites

- Node.js (v20 or later)
- PostgreSQL database
- npm or similar package manager

## Environment Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd insta-mockup
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create or update your environment configuration with the following variables:
   
   - `DATABASE_URL` - PostgreSQL connection string (required)
     ```
     DATABASE_URL=postgresql://user:password@localhost:5432/dbname
     ```
   
   - `SESSION_SECRET` - Session encryption key (optional, defaults to dev value)
     ```
     SESSION_SECRET=your-secret-key-here
     ```
   
   - `NODE_ENV` - Environment indicator (development/production)
     ```
     NODE_ENV=development
     ```

4. **Initialize the database**
   
   Push the database schema to PostgreSQL:
   ```bash
   npm run db:push
   ```

## Running the Application

### Development Mode

Run the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## Using the Application

### For Researchers

1. **Register/Login**
   - Navigate to the login page
   - Create a researcher account or log in with existing credentials

2. **Create a Project**
   - From the dashboard, create a new research project
   - Configure project settings:
     - Query parameter key (default: `participantId`)
     - Time limit in seconds (default: 300)
     - Redirect URL (where participants go after completion)
     - End screen message
     - Randomization seed and position locking options

3. **Create Experiments**
   - Within a project, create one or more experiments (feeds)
   - Each experiment gets a unique public URL for sharing with participants
   - Configure experiment settings:
     - Persist timer across page reloads
     - Show unmute prompt to participants

4. **Add Videos**
   - Add videos to your experiment
   - Configure video metadata:
     - Video URL
     - Username, avatar, caption
     - Engagement metrics (likes, comments, shares)
     - Song/audio information
     - Position and lock status

5. **Add Comments**
   - Manually add preseeded comments to videos
   - Or use AI generation to create realistic comments
   - Reorder comments as needed

6. **Share with Participants**
   - Share the experiment's public URL with participants
   - Append query parameters as configured (e.g., `?participantId=123`)

### For Participants

1. **Access the Feed**
   - Navigate to the public experiment URL provided by the researcher
   - The URL format: `/api/feed/:publicUrl?participantId=xxx`

2. **Interact with the Feed**
   - Scroll through vertical video feed
   - Like, comment, share videos
   - View and interact with comments
   - All interactions are logged for research analysis

## API Endpoints

The application exposes RESTful API endpoints for:

- **Authentication**: `/api/auth/*` - Login, logout, registration
- **Projects**: `/api/projects` - Project CRUD operations
- **Experiments**: `/api/projects/:projectId/experiments` - Experiment management
- **Videos**: `/api/experiments/:experimentId/videos` - Video management
- **Comments**: `/api/videos/:videoId/comments` - Comment management
- **Interactions**: `/api/interactions` - Participant interaction logging
- **Public Feed**: `/api/feed/:publicUrl` - Public-facing participant feed
- **Object Storage**: `/api/objects/*` - File upload and serving

For detailed API documentation, see `contracts/openapi.yaml`.

## Data Model

The application uses PostgreSQL with Drizzle ORM. Key entities include:

- **Researchers** - User accounts for research administrators
- **Projects** - Research projects with configurable settings
- **Experiments** - Individual experiments within projects
- **Videos** - Video content with metadata
- **Participants** - Participant tracking
- **Interactions** - Detailed interaction logs
- **Preseeded Comments** - Pre-populated comments on videos

For detailed schema documentation, see `data-model.md`.

## Development Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push schema changes to database

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Passport.js with local strategy
- **Session Store**: PostgreSQL via connect-pg-simple

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correctly formatted
- Ensure PostgreSQL is running and accessible
- Check database credentials and permissions

### Port Already in Use
- The dev server runs on port 5000 by default
- Ensure no other process is using this port

### Build Errors
- Run `npm run check` to identify TypeScript errors
- Ensure all dependencies are installed with `npm install`

## Next Steps

- Review the API documentation in `contracts/openapi.yaml`
- Explore the data model in `data-model.md`
- Refer to `replit.md` for detailed system architecture
