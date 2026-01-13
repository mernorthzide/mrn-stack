import path from "path";
import fs from "fs-extra";
import Handlebars from "handlebars";
import type { ProjectConfig } from "../types/config.js";

export abstract class BaseGenerator {
  abstract framework: string;

  abstract generate(projectPath: string, config: ProjectConfig): Promise<void>;

  protected async writeFile(
    projectPath: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const fullPath = path.join(projectPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, "utf-8");
  }

  protected async writeJSON(
    projectPath: string,
    filePath: string,
    data: object
  ): Promise<void> {
    await this.writeFile(projectPath, filePath, JSON.stringify(data, null, 2));
  }

  protected async copyDir(
    src: string,
    dest: string
  ): Promise<void> {
    await fs.copy(src, dest);
  }

  protected renderTemplate(template: string, data: object): string {
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  protected getPackageJson(config: ProjectConfig): object {
    return {
      name: config.projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: this.getScripts(config),
      dependencies: this.getDependencies(config),
      devDependencies: this.getDevDependencies(config),
    };
  }

  protected abstract getScripts(config: ProjectConfig): Record<string, string>;
  protected abstract getDependencies(config: ProjectConfig): Record<string, string>;
  protected abstract getDevDependencies(config: ProjectConfig): Record<string, string>;

  protected getTailwindConfig(config: ProjectConfig): string {
    const contentPaths = this.getTailwindContentPaths();
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    ${contentPaths.map((p) => `"${p}"`).join(",\n    ")}
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
  }

  protected abstract getTailwindContentPaths(): string[];

  protected getTailwindCSS(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
  }

  protected getESLintConfig(config: ProjectConfig): object {
    return {
      root: true,
      extends: ["eslint:recommended"],
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
    };
  }

  protected getPrettierConfig(): object {
    return {
      semi: true,
      singleQuote: false,
      tabWidth: 2,
      trailingComma: "es5",
      printWidth: 100,
    };
  }

  protected getGitignore(): string {
    return `# Dependencies
node_modules
.pnpm-store

# Build
dist
build
.next
.nuxt
.output
.astro

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage

# Misc
*.tsbuildinfo
`;
  }

  protected getTSConfig(config: ProjectConfig): object {
    return {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "ES2022"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "ESNext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"],
    };
  }

  protected getDockerfile(config: ProjectConfig): string {
    return `FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER appuser

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;
  }

  protected getDockerCompose(config: ProjectConfig): string {
    return `services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
`;
  }

  protected getEnvExample(config: ProjectConfig): string {
    let env = "# Environment Variables\n\n";

    if (config.database === "supabase") {
      env += `# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
`;
    }

    if (config.database === "convex") {
      env += `# Convex
CONVEX_DEPLOYMENT=your-deployment
NEXT_PUBLIC_CONVEX_URL=your-convex-url
`;
    }

    if (config.database === "neon" || config.database === "planetscale") {
      env += `# Database
DATABASE_URL=your-database-url
`;
    }

    if (config.auth === "next-auth") {
      env += `# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
`;
    }

    if (config.auth === "clerk") {
      env += `# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-publishable-key
CLERK_SECRET_KEY=your-secret-key
`;
    }

    if (config.auth === "better-auth") {
      env += `# Better Auth
BETTER_AUTH_SECRET=your-secret-here
`;
    }

    return env;
  }

  // AI Config Files
  protected getCursorRules(config: ProjectConfig): string {
    const frameworkName = this.getFrameworkDisplayName(config.framework);
    const dbInfo = config.database !== "none" ? `- Database: ${config.database}\n` : "";
    const authInfo = config.auth !== "none" ? `- Auth: ${config.auth}\n` : "";
    const stylingInfo = config.styling.includes("tailwind") ? "- Styling: Tailwind CSS\n" : "";

    return `# ${config.projectName}

## Project Overview
This is a ${frameworkName} project created with create-mrn-app.

## Tech Stack
- Framework: ${frameworkName}
${dbInfo}${authInfo}${stylingInfo}- Language: ${config.extras.typescript ? "TypeScript" : "JavaScript"}

## Code Style
- Use ${config.extras.typescript ? "TypeScript" : "JavaScript"} for all code
- Follow existing patterns in the codebase
- Use functional components with hooks
- Prefer named exports over default exports
- Use path aliases (@/) for imports

## File Structure
- \`app/\` or \`src/\` - Application code
- \`components/\` - Reusable UI components
- \`lib/\` - Utility functions and configurations
- \`public/\` - Static assets

## Conventions
- Component files: PascalCase (e.g., Button.tsx)
- Utility files: camelCase (e.g., utils.ts)
- Use semantic HTML elements
- Keep components small and focused
- Extract reusable logic into custom hooks

## Commands
- \`${config.packageManager === "npm" ? "npm run dev" : config.packageManager + " dev"}\` - Start development server
- \`${config.packageManager === "npm" ? "npm run build" : config.packageManager + " build"}\` - Build for production
- \`${config.packageManager === "npm" ? "npm run lint" : config.packageManager + " lint"}\` - Run linter
`;
  }

  protected getClaudeMd(config: ProjectConfig): string {
    const frameworkName = this.getFrameworkDisplayName(config.framework);
    const dbInfo = config.database !== "none" ? `\n- **Database**: ${config.database}` : "";
    const authInfo = config.auth !== "none" ? `\n- **Auth**: ${config.auth}` : "";

    return `# ${config.projectName}

## Project Context
${frameworkName} application created with create-mrn-app.

## Tech Stack
- **Framework**: ${frameworkName}${dbInfo}${authInfo}
- **Styling**: ${config.styling.includes("tailwind") ? "Tailwind CSS" : config.styling}
- **Language**: ${config.extras.typescript ? "TypeScript" : "JavaScript"}
- **Package Manager**: ${config.packageManager}

## Directory Structure
\`\`\`
${this.getDirectoryStructure(config)}
\`\`\`

## Development Commands
\`\`\`bash
${config.packageManager}${config.packageManager === "npm" ? " run" : ""} dev      # Start dev server
${config.packageManager}${config.packageManager === "npm" ? " run" : ""} build    # Build for production
${config.packageManager}${config.packageManager === "npm" ? " run" : ""} lint     # Run linter
\`\`\`

## Code Conventions
1. **Components**: Use functional components with hooks
2. **Imports**: Use \`@/\` path alias for absolute imports
3. **Naming**: PascalCase for components, camelCase for utilities
4. **Types**: ${config.extras.typescript ? "Define types/interfaces for all props and data" : "Use JSDoc for type hints"}

## Key Files
- \`${config.framework === "next" ? "app/layout.tsx" : "src/main.tsx"}\` - Root layout/entry
- \`${config.framework === "next" ? "app/page.tsx" : "src/App.tsx"}\` - Main page component
- \`lib/\` - Shared utilities and configurations
${config.database !== "none" ? `- \`lib/${config.database === "supabase" ? "supabase" : "db"}/\` - Database client\n` : ""}
## Notes
- Environment variables are in \`.env.local\`
- Run \`${config.packageManager}${config.packageManager === "npm" ? " run" : ""} dev\` to start developing
`;
  }

  private getFrameworkDisplayName(framework: string): string {
    const names: Record<string, string> = {
      next: "Next.js",
      react: "React",
      vue: "Vue.js",
      astro: "Astro",
    };
    return names[framework] || framework;
  }

  private getDirectoryStructure(config: ProjectConfig): string {
    if (config.framework === "next") {
      return `├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
├── lib/
└── public/`;
    }
    return `├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
├── public/
└── index.html`;
  }

  // Helper method to write AI config files
  protected async writeAIConfigFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    await this.writeFile(projectPath, ".cursorrules", this.getCursorRules(config));
    await this.writeFile(projectPath, "CLAUDE.md", this.getClaudeMd(config));
  }
}
