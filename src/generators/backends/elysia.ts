import type { ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";

export class ElysiaGenerator extends BaseBackendGenerator {
  framework = "elysia" as const;

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));
    await this.writeJSON(projectPath, "tsconfig.json", this.getTSConfig());

    await this.writeFile(projectPath, "src/index.ts", this.getEntryFile(config));
    await this.writeFile(projectPath, "src/routes/health.ts", this.getHealthRoute());
    await this.writeFile(projectPath, "src/routes/users.ts", this.getUserRoutes(config));
    await this.writeFile(projectPath, "src/routes/items.ts", this.getItemRoutes(config));

    await this.writeFile(projectPath, "src/schemas/index.ts", this.getElysiaSchemas());
    await this.writeFile(projectPath, "src/utils/errors.ts", this.getErrorTypes());

    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }

    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".gitignore", this.getBackendGitignore());

    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getBunDockerfile());
    }
  }

  getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {
      dev: "bun run --hot src/index.ts",
      build: "bun build src/index.ts --outdir dist --target bun",
      start: "bun run dist/index.js",
      test: "bun test",
    };

    if (config.orm === "prisma") {
      scripts["db:generate"] = "prisma generate";
      scripts["db:push"] = "prisma db push";
    }

    if (config.orm === "drizzle") {
      scripts["db:generate"] = "drizzle-kit generate";
      scripts["db:push"] = "drizzle-kit push";
    }

    return scripts;
  }

  getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      elysia: "^1.2.0",
      "@elysiajs/cors": "^1.1.0",
    };

    // ORM dependencies (Bun-compatible versions)
    if (config.orm === "prisma") {
      deps["@prisma/client"] = "^5.22.0";
    }

    if (config.orm === "drizzle") {
      deps["drizzle-orm"] = "^0.36.0";
      if (config.database === "sqlite" || config.database === "turso") {
        deps["bun:sqlite"] = "*"; // Built-in Bun SQLite
      }
    }

    return deps;
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {
      "bun-types": "latest",
      typescript: "^5.6.0",
    };

    if (config.orm === "prisma") {
      devDeps["prisma"] = "^5.22.0";
    }

    if (config.orm === "drizzle") {
      devDeps["drizzle-kit"] = "^0.28.0";
    }

    return devDeps;
  }

  private getEntryFile(_config: ProjectConfig): string {
    return `import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { healthRoutes } from "./routes/health";
import { userRoutes } from "./routes/users";
import { itemRoutes } from "./routes/items";

const app = new Elysia()
  .use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }))
  .onError(({ code, error, set }) => {
    console.error("Error:", error);

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.all,
        },
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Route not found" } };
    }

    set.status = 500;
    return {
      error: {
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "production" ? "Internal server error" : error.message,
      },
    };
  })
  .use(healthRoutes)
  .use(userRoutes)
  .use(itemRoutes)
  .listen(Number(process.env.PORT) || 4000);

console.log(\`Server running on http://localhost:\${app.server?.port}\`);

export type App = typeof app;
`;
  }

  private getHealthRoute(): string {
    return `import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/api/health" })
  .get("/", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));
`;
  }

  private getUserRoutes(_config: ProjectConfig): string {
    return `import { Elysia, t } from "elysia";

const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

export const userRoutes = new Elysia({ prefix: "/api/users" })
  .get("/", ({ query }) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const allUsers = Array.from(users.values());
    const start = (page - 1) * limit;
    return {
      data: allUsers.slice(start, start + limit),
      meta: { total: allUsers.length, page, limit },
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  })
  .get("/:id", ({ params, set }) => {
    const user = users.get(params.id);
    if (!user) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "User not found" } };
    }
    return { data: user };
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post("/", ({ body, set }) => {
    const id = crypto.randomUUID();
    const user = { id, ...body, createdAt: new Date() };
    users.set(id, user);
    set.status = 201;
    return { data: user };
  }, {
    body: t.Object({
      email: t.String({ format: "email" }),
      name: t.String({ minLength: 1, maxLength: 100 }),
      password: t.String({ minLength: 8, maxLength: 100 }),
    }),
  })
  .put("/:id", ({ params, body, set }) => {
    const user = users.get(params.id);
    if (!user) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "User not found" } };
    }
    const updated = { ...user, ...body };
    users.set(params.id, updated);
    return { data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      email: t.Optional(t.String({ format: "email" })),
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    }),
  })
  .delete("/:id", ({ params, set }) => {
    if (!users.delete(params.id)) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "User not found" } };
    }
    set.status = 204;
    return null;
  }, {
    params: t.Object({ id: t.String() }),
  });
`;
  }

  private getItemRoutes(_config: ProjectConfig): string {
    return `import { Elysia, t } from "elysia";

const items = new Map<string, { id: string; title: string; description?: string; status: string; createdAt: Date }>();

export const itemRoutes = new Elysia({ prefix: "/api/items" })
  .get("/", ({ query }) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const allItems = Array.from(items.values());
    const start = (page - 1) * limit;
    return {
      data: allItems.slice(start, start + limit),
      meta: { total: allItems.length, page, limit },
    };
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  })
  .get("/:id", ({ params, set }) => {
    const item = items.get(params.id);
    if (!item) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Item not found" } };
    }
    return { data: item };
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post("/", ({ body, set }) => {
    const id = crypto.randomUUID();
    const item = { id, ...body, status: body.status || "draft", createdAt: new Date() };
    items.set(id, item);
    set.status = 201;
    return { data: item };
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 200 }),
      description: t.Optional(t.String({ maxLength: 1000 })),
      status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")])),
    }),
  })
  .put("/:id", ({ params, body, set }) => {
    const item = items.get(params.id);
    if (!item) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Item not found" } };
    }
    const updated = { ...item, ...body };
    items.set(params.id, updated);
    return { data: updated };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      description: t.Optional(t.String({ maxLength: 1000 })),
      status: t.Optional(t.Union([t.Literal("draft"), t.Literal("published"), t.Literal("archived")])),
    }),
  })
  .delete("/:id", ({ params, set }) => {
    if (!items.delete(params.id)) {
      set.status = 404;
      return { error: { code: "NOT_FOUND", message: "Item not found" } };
    }
    set.status = 204;
    return null;
  }, {
    params: t.Object({ id: t.String() }),
  });
`;
  }

  private getElysiaSchemas(): string {
    return `// Elysia uses TypeBox (t) for validation, which is built-in
// These Zod schemas are kept for reference/compatibility

import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(100),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
});

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
`;
  }

  private getBunDockerfile(): string {
    return `FROM oven/bun:latest AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build src/index.ts --outdir dist --target bun

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup
RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER appuser

EXPOSE 4000

CMD ["bun", "run", "dist/index.js"]
`;
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    if (config.orm === "prisma") {
      await this.writeFile(projectPath, "prisma/schema.prisma", this.getPrismaSchema(config));
    }
    if (config.orm === "drizzle") {
      await this.writeFile(projectPath, "src/db/schema.ts", this.getDrizzleSchema(config));
      await this.writeFile(projectPath, "drizzle.config.ts", this.getDrizzleConfig(config));
    }
  }
}
