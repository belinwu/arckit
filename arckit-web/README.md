# ArcKit Web

Standalone web application for the ArcKit Enterprise Architecture Governance Toolkit, powered by the Claude Agent SDK.

## Quick Start

1. Install dependencies: `npm install`
2. Set up database: `npx drizzle-kit push`
3. Start dev server: `npm run dev`
4. Open http://localhost:3000
5. Enter your Anthropic API key

## Architecture

- **Frontend**: Next.js 15 (App Router) + React + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Claude CLI (`@anthropic-ai/claude-code`)
- **Database**: SQLite via Drizzle ORM
- **Auth**: BYOK (Bring Your Own Anthropic API Key)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/commands | List all 54 ArcKit commands |
| GET | /api/projects | List all projects |
| POST | /api/projects | Create a new project |
| GET | /api/projects/:id | Get project with artifacts |
| GET | /api/projects/:id/artifacts | List project artifacts |
| POST | /api/run | Execute a command (SSE streaming) |

## Development

- `npm run dev` -- Start dev server
- `npm run build` -- Production build
- `npx vitest` -- Run tests
- `npx drizzle-kit studio` -- Database viewer
