import type { ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";

export class HonoGenerator extends BaseBackendGenerator {
  framework = "hono" as const;

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));
    await this.writeJSON(projectPath, "tsconfig.json", this.getTSConfig());

    await this.writeFile(projectPath, "src/index.ts", this.getEntryFile(config));
    await this.writeFile(projectPath, "src/routes/health.ts", this.getHealthRoute());
    await this.writeFile(projectPath, "src/routes/users.ts", this.getUserRoutes(config));
    await this.writeFile(projectPath, "src/routes/items.ts", this.getItemRoutes(config));

    await this.writeFile(projectPath, "src/schemas/index.ts", this.getZodSchemas());
    await this.writeFile(projectPath, "src/middleware/error.ts", this.getErrorMiddleware());
    await this.writeFile(projectPath, "src/utils/logger.ts", this.getPinoLogger());
    await this.writeFile(projectPath, "src/utils/errors.ts", this.getErrorTypes());

    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }

    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".gitignore", this.getBackendGitignore());

    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getBackendDockerfile(config));
    }
  }

  getScripts(config: ProjectConfig): Record<string, string> {
    const isBun = config.runtime === "bun";
    const scripts: Record<string, string> = {
      dev: isBun ? "bun run --hot src/index.ts" : "tsx watch src/index.ts",
      build: isBun ? "bun build src/index.ts --outdir dist --target bun" : "tsc",
      start: isBun ? "bun run dist/index.js" : "node dist/index.js",
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
      hono: "^4.6.0",
      "@hono/zod-validator": "^0.4.0",
      ...this.getCommonDependencies(config),
    };

    if (config.runtime === "node") {
      deps["@hono/node-server"] = "^1.13.0";
      deps["pino"] = "^9.5.0";
    }

    return deps;
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps = { ...this.getCommonDevDependencies(config) };
    if (config.runtime === "node") {
      devDeps["pino-pretty"] = "^13.0.0";
    }
    return devDeps;
  }

  private getEntryFile(config: ProjectConfig): string {
    const isBun = config.runtime === "bun";

    if (isBun) {
      return `import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { itemRoutes } from "./routes/items.js";
import { errorHandler } from "./middleware/error.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

// Error handler
app.onError(errorHandler);

// Routes
app.route("/api/health", healthRoutes);
app.route("/api/users", userRoutes);
app.route("/api/items", itemRoutes);

const port = Number(process.env.PORT) || 4000;
console.log(\`Server running on http://localhost:\${port}\`);

export default {
  port,
  fetch: app.fetch,
};
`;
    }

    return `import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { itemRoutes } from "./routes/items.js";
import { errorHandler } from "./middleware/error.js";
import { logger as pinoLogger } from "./utils/logger.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

// Error handler
app.onError(errorHandler);

// Routes
app.route("/api/health", healthRoutes);
app.route("/api/users", userRoutes);
app.route("/api/items", itemRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, (info) => {
  pinoLogger.info(\`Server running on http://localhost:\${info.port}\`);
});
`;
  }

  private getHealthRoute(): string {
    return `import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);
`;
  }

  private getUserRoutes(_config: ProjectConfig): string {
    return `import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createUserSchema, updateUserSchema, paginationSchema } from "../schemas/index.js";

export const userRoutes = new Hono();

const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

userRoutes.get("/", zValidator("query", paginationSchema), (c) => {
  const { page, limit } = c.req.valid("query");
  const allUsers = Array.from(users.values());
  const start = (page - 1) * limit;
  return c.json({
    data: allUsers.slice(start, start + limit),
    meta: { total: allUsers.length, page, limit },
  });
});

userRoutes.get("/:id", (c) => {
  const user = users.get(c.req.param("id"));
  if (!user) return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
  return c.json({ data: user });
});

userRoutes.post("/", zValidator("json", createUserSchema), (c) => {
  const body = c.req.valid("json");
  const id = crypto.randomUUID();
  const user = { id, ...body, createdAt: new Date() };
  users.set(id, user);
  return c.json({ data: user }, 201);
});

userRoutes.put("/:id", zValidator("json", updateUserSchema), (c) => {
  const user = users.get(c.req.param("id"));
  if (!user) return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
  const body = c.req.valid("json");
  const updated = { ...user, ...body };
  users.set(c.req.param("id"), updated);
  return c.json({ data: updated });
});

userRoutes.delete("/:id", (c) => {
  if (!users.delete(c.req.param("id"))) {
    return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);
  }
  return c.body(null, 204);
});
`;
  }

  private getItemRoutes(_config: ProjectConfig): string {
    return `import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createItemSchema, updateItemSchema, paginationSchema } from "../schemas/index.js";

export const itemRoutes = new Hono();

const items = new Map<string, { id: string; title: string; description?: string; status: string; createdAt: Date }>();

itemRoutes.get("/", zValidator("query", paginationSchema), (c) => {
  const { page, limit } = c.req.valid("query");
  const allItems = Array.from(items.values());
  const start = (page - 1) * limit;
  return c.json({
    data: allItems.slice(start, start + limit),
    meta: { total: allItems.length, page, limit },
  });
});

itemRoutes.get("/:id", (c) => {
  const item = items.get(c.req.param("id"));
  if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Item not found" } }, 404);
  return c.json({ data: item });
});

itemRoutes.post("/", zValidator("json", createItemSchema), (c) => {
  const body = c.req.valid("json");
  const id = crypto.randomUUID();
  const item = { id, ...body, status: body.status || "draft", createdAt: new Date() };
  items.set(id, item);
  return c.json({ data: item }, 201);
});

itemRoutes.put("/:id", zValidator("json", updateItemSchema), (c) => {
  const item = items.get(c.req.param("id"));
  if (!item) return c.json({ error: { code: "NOT_FOUND", message: "Item not found" } }, 404);
  const body = c.req.valid("json");
  const updated = { ...item, ...body };
  items.set(c.req.param("id"), updated);
  return c.json({ data: updated });
});

itemRoutes.delete("/:id", (c) => {
  if (!items.delete(c.req.param("id"))) {
    return c.json({ error: { code: "NOT_FOUND", message: "Item not found" } }, 404);
  }
  return c.body(null, 204);
});
`;
  }

  private getErrorMiddleware(): string {
    return `import { Context } from "hono";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export function errorHandler(err: Error, c: Context) {
  console.error("Error:", err);

  if (err instanceof ZodError) {
    return c.json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      },
    }, 400);
  }

  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as any);
  }

  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  }, 500);
}
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
