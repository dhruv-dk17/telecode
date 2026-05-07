# Spec: Telecode

## Objective
Telecode is a developer-centric platform that allows engineers to manage, explain, and execute code changes across their repositories directly from Telegram. It acts as a bridge between a mobile interface and a desktop-based VS Code environment, ensuring workflow continuity.

**User Stories:**
- As a developer, I want to explain a bug to Telecode on my phone and have it suggest a fix.
- As a developer, I want to "plan" a feature on mobile and then see the implementation tasks waiting for me in VS Code.
- As a developer, I want Telecode to execute safe refactors or documentation updates automatically.

## Tech Stack
- **Languages:** TypeScript (Node.js), Python 3.11+
- **Frameworks:**
  - Bot: Telegraf.js (Node.js)
  - Server: NestJS (Node.js)
  - AI: LangGraph / LangChain (Python)
- **Database:** PostgreSQL + pgvector (Supabase)
- **Infrastructure:** Docker, npm workspaces

## Commands
- **Build:** `npm run build` (root)
- **Test:** `npm test`
- **Lint:** `npm run lint`
- **Dev:** `docker-compose up`

## Project Structure
```text
/telecode
  ├── apps/
  │   ├── bot/          # Telegram Bot interface
  │   ├── server/       # Main API & Orchestration (NestJS)
  │   └── worker/       # AI & Repo Workspace Engine (Python)
  ├── packages/         # Shared logic/types
  ├── docker-compose.yml
  ├── PRD.md            # Product vision
  └── SPEC.md           # Technical specification
```

## Code Style
- **Conventions:** Prettier + ESLint (Standard/Recommended)
- **Naming:** CamelCase for TS, snake_case for Python.
- **Example (TS):**
```typescript
export class BotService {
  async handleCommand(ctx: Context) {
    const userId = ctx.from.id;
    // Implementation
  }
}
```

## Testing Strategy
- **Framework:** Jest (Node.js), Pytest (Python)
- **Locations:** `apps/*/test`
- **Levels:** Unit tests for logic, Integration tests for Bot-to-Server communication.

## Boundaries
- **Always:** Use environment variables for secrets, run linting before commits.
- **Ask first:** Adding new major dependencies, changing database schema.
- **Never:** Commit `.env` files, use hardcoded API keys.

## Success Criteria
- [ ] Bot responds to `/start` and `/connect`.
- [ ] User can link their GitHub/VS Code environment.
- [ ] Server can fetch repository structure.
- [ ] AI worker can generate a "Plan" for a simple code change.

## Open Questions
- **Auth:** Should we start with a simple GitHub OAuth flow for both Bot and VS Code?
- **Sync:** How real-time should the VS Code sync be? (WebSockets vs. polling).
- **Deployment:** Initial target platform (e.g., Railway, DigitalOcean)?
