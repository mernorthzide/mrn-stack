# create-mrn-app

CLI to scaffold modern full-stack applications with your choice of framework, database, auth, and styling.

## Quick Start

```bash
# Interactive mode
npx create-mrn-app@latest

# With flags
npx create-mrn-app my-app --framework next --db supabase --auth clerk --styling tailwind --pm pnpm
```

## Features

### Frameworks
- **Next.js** - React framework with App Router
- **React** - Vite-powered React SPA
- **Vue** - Vite-powered Vue 3 SPA
- **Astro** - Content-focused with islands

### Databases
- **Supabase** - PostgreSQL + Realtime + Auth
- **Convex** - Reactive backend-as-a-service
- **Neon** - Serverless PostgreSQL
- **SQLite** - Local embedded database
- **Turso** - Edge SQLite (libSQL)
- **PlanetScale** - MySQL-compatible serverless

### Authentication
- **NextAuth / Auth.js** - Flexible, self-hosted
- **Clerk** - Managed auth with UI components
- **Supabase Auth** - Built-in with Supabase
- **Better Auth** - Modern, flexible auth library

### Styling
- **Tailwind CSS** - Utility-first CSS
- **Tailwind + shadcn/ui** - Beautiful components
- **CSS Modules** - Scoped CSS
- **Vanilla CSS** - Plain CSS

### Additional Features
- **TypeScript** - Type-safe development (default)
- **ESLint + Prettier** - Code quality (default)
- **Vitest** - Unit & integration testing
- **Docker** - Container support

### Package Managers
- npm
- pnpm (recommended)
- bun

## CLI Options

```
Usage: create-mrn-app [options] [project-name]

Options:
  -V, --version                output the version number
  -f, --framework <framework>  Framework: next, react, vue, astro
  -d, --db <database>          Database: supabase, convex, neon, sqlite, turso, planetscale, none
  -a, --auth <auth>            Auth: next-auth, clerk, supabase-auth, better-auth, none
  -s, --styling <styling>      Styling: tailwind, tailwind-shadcn, css-modules, vanilla
  -p, --pm <pm>                Package manager: npm, pnpm, bun
  --typescript                 Use TypeScript (default: true)
  --no-typescript              Disable TypeScript
  --eslint                     Add ESLint + Prettier (default: true)
  --no-eslint                  Skip ESLint
  --docker                     Add Docker support
  --testing                    Add testing setup (Vitest)
  -y, --yes                    Skip prompts and use defaults
  -h, --help                   display help for command
```

## Examples

### Next.js + Supabase + Clerk + Tailwind
```bash
npx create-mrn-app my-app -f next -d supabase -a clerk -s tailwind -p pnpm
```

### React + Convex + Tailwind + shadcn/ui
```bash
npx create-mrn-app my-app -f react -d convex -a none -s tailwind-shadcn -p bun
```

### Vue + Neon + Better Auth
```bash
npx create-mrn-app my-app -f vue -d neon -a better-auth -s tailwind -p pnpm
```

### Astro + Supabase + Clerk
```bash
npx create-mrn-app my-app -f astro -d supabase -a clerk -s tailwind -p pnpm
```

### Quick start with defaults
```bash
npx create-mrn-app my-app -y
# Creates: Next.js + No DB + No Auth + Tailwind + pnpm
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development
pnpm dev

# Test locally
node dist/index.js my-test-app
```

## License

MIT
