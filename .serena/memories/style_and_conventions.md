# Code Style and Conventions

## TypeScript
- Strict mode enabled
- Use `type` imports for type-only imports: `import type { Foo } from '...'`
- ESM with `.js` extensions in server imports (not in client due to bundler)
- 2-space indentation
- Single quotes for strings
- Semicolons required

## Naming
- Interfaces: PascalCase (e.g., `APState`, `SectorData`, `PlayerPresence`)
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: camelCase for modules, PascalCase for React components

## Patterns
- Zustand slices pattern (createGameSlice, createUISlice)
- Colyseus schemas with decorators (@type, @filter)
- Singleton pattern for network client (exported const `network`)
