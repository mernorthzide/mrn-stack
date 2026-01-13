import path from "path";
import fs from "fs-extra";
import type { ProjectConfig, BackendFramework } from "../../types/config.js";

export abstract class BaseBackendGenerator {
  abstract framework: BackendFramework;

  abstract generate(projectPath: string, config: ProjectConfig): Promise<void>;
  abstract getScripts(config: ProjectConfig): Record<string, string>;
  abstract getDependencies(config: ProjectConfig): Record<string, string>;
  abstract getDevDependencies(config: ProjectConfig): Record<string, string>;

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

  // Common backend package.json structure
  protected getPackageJson(config: ProjectConfig): object {
    return {
      name: `${config.projectName}-backend`,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: this.getScripts(config),
      dependencies: this.getDependencies(config),
      devDependencies: this.getDevDependencies(config),
    };
  }

  // Zod validation schemas
  protected getZodSchemas(): string {
    return `import { z } from "zod";

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
});

export const userIdSchema = z.object({
  id: z.string().uuid(),
});

// Item schemas
export const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const itemIdSchema = z.object({
  id: z.string().uuid(),
});

// Query schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Types derived from schemas
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
`;
  }

  // Pino logger setup
  protected getPinoLogger(): string {
    return `import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

export default logger;
`;
  }

  // Error types
  protected getErrorTypes(): string {
    return `export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(\`\${resource} not found\`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation failed") {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}
`;
  }

  // Backend .env.example
  protected getEnvExample(config: ProjectConfig): string {
    let env = `# Server
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:3000

`;

    if (config.database === "mongodb") {
      env += `# MongoDB
MONGODB_URI=mongodb://localhost:27017/${config.projectName}
`;
    }

    if (config.database === "supabase") {
      env += `# Supabase
DATABASE_URL=postgresql://postgres:password@localhost:5432/${config.projectName}
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
`;
    }

    if (config.database === "neon" || config.database === "planetscale" || config.database === "turso") {
      env += `# Database
DATABASE_URL=your-database-url
`;
    }

    if (config.database === "sqlite") {
      env += `# SQLite
DATABASE_URL=file:./dev.db
`;
    }

    if (config.auth === "clerk") {
      env += `
# Clerk
CLERK_SECRET_KEY=your-secret-key
`;
    }

    if (config.auth === "better-auth" || config.auth === "next-auth") {
      env += `
# Auth
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=7d
`;
    }

    return env;
  }

  // Backend gitignore additions
  protected getBackendGitignore(): string {
    return `# Dependencies
node_modules

# Build
dist
build

# Environment
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite

# Logs
*.log
logs/

# IDE
.vscode
.idea

# OS
.DS_Store

# Testing
coverage
`;
  }

  // Backend TypeScript config
  protected getTSConfig(): object {
    return {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2022"],
        outDir: "./dist",
        rootDir: "./src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"],
    };
  }

  // Backend Dockerfile
  protected getBackendDockerfile(config: ProjectConfig): string {
    const pm = config.packageManager;
    const installCmd = pm === "npm" ? "npm ci" : pm === "bun" ? "bun install --frozen-lockfile" : "pnpm install --frozen-lockfile";
    const buildCmd = pm === "npm" ? "npm run build" : `${pm} build`;
    const startCmd = pm === "bun" ? "bun run dist/index.js" : "node dist/index.js";

    return `FROM node:20-alpine AS base

${pm === "pnpm" ? "RUN corepack enable && corepack prepare pnpm@latest --activate" : ""}
${pm === "bun" ? "RUN npm install -g bun" : ""}

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ${pm === "pnpm" ? "pnpm-lock.yaml" : pm === "bun" ? "bun.lockb" : "package-lock.json"} ./
RUN ${installCmd}

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ${buildCmd}

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER appuser

EXPOSE 4000

CMD ["${startCmd.split(" ")[0]}", "${startCmd.split(" ").slice(1).join('", "')}"]
`;
  }

  // Common dependencies based on config
  protected getCommonDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      zod: "^3.23.0",
      dotenv: "^16.4.0",
    };

    // ORM dependencies
    if (config.orm === "prisma") {
      deps["@prisma/client"] = "^5.22.0";
    }

    if (config.orm === "drizzle") {
      deps["drizzle-orm"] = "^0.36.0";

      if (config.database === "sqlite" || config.database === "turso") {
        deps["better-sqlite3"] = "^11.6.0";
      }
      if (config.database === "neon" || config.database === "supabase") {
        deps["@neondatabase/serverless"] = "^0.10.0";
      }
      if (config.database === "planetscale") {
        deps["@planetscale/database"] = "^1.19.0";
      }
    }

    // MongoDB
    if (config.database === "mongodb") {
      if (config.orm === "prisma") {
        // Prisma handles MongoDB
      } else {
        deps["mongodb"] = "^6.11.0";
      }
    }

    return deps;
  }

  // Common dev dependencies
  protected getCommonDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {
      typescript: "^5.6.0",
      "@types/node": "^22.10.0",
      tsx: "^4.19.0",
    };

    if (config.orm === "prisma") {
      devDeps["prisma"] = "^5.22.0";
    }

    if (config.orm === "drizzle") {
      devDeps["drizzle-kit"] = "^0.28.0";
      if (config.database === "sqlite" || config.database === "turso") {
        devDeps["@types/better-sqlite3"] = "^7.6.0";
      }
    }

    return devDeps;
  }

  // Prisma schema generator
  protected getPrismaSchema(config: ProjectConfig): string {
    let datasource = "";

    if (config.database === "mongodb") {
      datasource = `datasource db {
  provider = "mongodb"
  url      = env("MONGODB_URI")
}`;
    } else if (config.database === "sqlite") {
      datasource = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;
    } else if (config.database === "planetscale") {
      datasource = `datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}`;
    } else {
      datasource = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;
    }

    const idField = config.database === "mongodb"
      ? `id String @id @default(auto()) @map("_id") @db.ObjectId`
      : `id String @id @default(uuid())`;

    return `generator client {
  provider = "prisma-client-js"
}

${datasource}

model User {
  ${idField}
  email     String   @unique
  name      String
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  items     Item[]
}

model Item {
  ${idField}
  title       String
  description String?
  status      String   @default("draft")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  userId      String   ${config.database === "mongodb" ? "@db.ObjectId" : ""}
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
`;
  }

  // Drizzle schema generator
  protected getDrizzleSchema(config: ProjectConfig): string {
    if (config.database === "sqlite" || config.database === "turso") {
      return `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  user: one(users, { fields: [items.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
`;
    }

    // PostgreSQL / MySQL
    const isMySQL = config.database === "planetscale";
    const tableImport = isMySQL ? "mysqlTable" : "pgTable";
    const tableModule = isMySQL ? "drizzle-orm/mysql-core" : "drizzle-orm/pg-core";

    return `import { ${tableImport}, text, timestamp, uuid } from "${tableModule}";
import { relations } from "drizzle-orm";

export const users = ${tableImport}("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const items = ${tableImport}("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  user: one(users, { fields: [items.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
`;
  }

  // Drizzle config
  protected getDrizzleConfig(config: ProjectConfig): string {
    let driver = "better-sqlite";
    let dbCredentials = `url: process.env.DATABASE_URL!`;

    if (config.database === "neon" || config.database === "supabase") {
      driver = "pg";
    } else if (config.database === "planetscale") {
      driver = "mysql2";
    } else if (config.database === "turso") {
      driver = "turso";
      dbCredentials = `url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN`;
    }

    return `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${driver === "pg" ? "postgresql" : driver === "mysql2" ? "mysql" : "sqlite"}",
  dbCredentials: {
    ${dbCredentials}
  },
});
`;
  }
}
