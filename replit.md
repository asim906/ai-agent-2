# Workspace

## Overview

pnpm workspace monorepo using TypeScript. WhatsApp AI Automation SaaS platform called "Nexus Ops".

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Replit Auth (OpenID Connect / PKCE)
- **Frontend**: React + Vite (TailwindCSS v4, shadcn/ui, wouter, TanStack Query)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server with auth, WhatsApp, chats, AI, memory, tools, analytics routes
│   └── whatsapp-ai/        # React+Vite frontend (Nexus Ops app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Browser auth hook (useAuth)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **Authentication**: Replit Auth (login/logout, protected routes)
- **WhatsApp Connection**: QR code scanning, connection status tracking
- **Dashboard**: Overview stats, automation toggle
- **Live Chats**: Real-time chat list + message view with reply capability (3s polling)
- **AI Settings**: OpenAI/OpenRouter/Gemini configuration, API key storage, temperature/tokens
- **Memory System**: Chat memory stats + Custom Q&A training pairs
- **Tools**: CSV/Excel file upload and management
- **Analytics**: Daily activity charts (recharts), success rate metrics
- **Automation**: Toggle AI auto-reply on/off

## Database Schema

Tables: `sessions`, `users`, `whatsapp_sessions`, `chats`, `messages`, `ai_settings`, `custom_memory`, `csv_files`

## API Routes

All routes under `/api/`:
- Auth: `/auth/user`, `/login`, `/callback`, `/logout`
- WhatsApp: `/whatsapp/status`, `/whatsapp/qr`, `/whatsapp/disconnect`
- Automation: `/automation/toggle`, `/automation/status`
- Chats: `/chats`, `/chats/:id`, `/chats/:id/messages`, `/chats/:id/send`
- AI: `/ai-settings` (GET/PUT)
- Memory: `/memory/chats`, `/memory/custom` (CRUD)
- Tools: `/tools/csv` (CRUD)
- Analytics: `/analytics/summary`, `/analytics/daily`
