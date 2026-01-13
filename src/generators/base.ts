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
}
