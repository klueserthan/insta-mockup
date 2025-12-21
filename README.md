# InstaReel Research

A full-stack web application for conducting research experiments using social media-style video feeds.

## Quick Start

For detailed setup instructions, see [Quickstart Guide](specs/001-instagram-mockup-feed/quickstart.md).

```bash
# Install dependencies
npm install

# Configure environment
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# Initialize database
npm run db:push

# Run development server
npm run dev
```

Visit http://localhost:5000 to access the application.

## Documentation

- **[Quickstart Guide](specs/001-instagram-mockup-feed/quickstart.md)** - Setup and usage instructions
- **[API Documentation](specs/001-instagram-mockup-feed/contracts/openapi.yaml)** - Complete API specification (OpenAPI 3.0)
- **[Data Model](specs/001-instagram-mockup-feed/data-model.md)** - Database schema and relationships
- **[System Architecture](replit.md)** - Detailed technical documentation

## Features

- 🎬 Instagram/TikTok-style vertical video feed interface
- 📊 Research project and experiment management
- 👥 Participant interaction tracking
- 🔀 Configurable video randomization
- 💬 Preseeded comments (manual or AI-generated)
- 📈 Engagement metrics collection
- 🔒 Session-based authentication
- ☁️ Object storage for video uploads

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript + Passport.js
- **Database**: PostgreSQL + Drizzle ORM
- **Storage**: Google Cloud Storage

## Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run check        # Run TypeScript type checking
npm run db:push      # Push schema changes to database
```

## License

MIT
