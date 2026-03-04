# Suggested Commands

## Development
- `npm run dev:server` - Start the game server (port 2567)
- `npm run dev:client` - Start the Vite dev server (port 3000)
- `npm run build` - Build all packages (shared -> server -> client)
- `npm test` - Run all tests
- `npm run docker:up` - Start PostgreSQL + Redis
- `npm run docker:down` - Stop Docker services

## Testing
- `cd packages/server && npx vitest run` - Run all server tests (57 tests)
- `cd packages/client && npx vitest run` - Run all client tests (40 tests)
- `cd packages/shared && npx vitest run` - Run all shared tests (5 tests)
- `cd packages/server && npx vitest run src/engine/__tests__/commands.test.ts` - Run specific test file

## TypeScript Checking
- `cd packages/client && npx tsc --noEmit` - Type-check client
- `cd packages/server && npx tsc --noEmit` - Type-check server
- `cd packages/shared && npx tsc --noEmit` - Type-check shared

## System (Windows with bash shell)
- Use Unix-style paths with forward slashes
- Use `/dev/null` not `NUL`
- Git is available
