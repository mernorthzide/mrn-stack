import type { ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";

export class FastifyGenerator extends BaseBackendGenerator {
  framework = "fastify" as const;

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));
    await this.writeJSON(projectPath, "tsconfig.json", this.getTSConfig());

    await this.writeFile(projectPath, "src/index.ts", this.getEntryFile(config));
    await this.writeFile(projectPath, "src/app.ts", this.getAppFile(config));

    await this.writeFile(projectPath, "src/routes/health.ts", this.getHealthRoute());
    await this.writeFile(projectPath, "src/routes/users.ts", this.getUserRoutes(config));
    await this.writeFile(projectPath, "src/routes/items.ts", this.getItemRoutes(config));

    await this.writeFile(projectPath, "src/schemas/index.ts", this.getZodSchemas());
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
    const scripts: Record<string, string> = {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
    };

    if (config.orm === "prisma") {
      scripts["db:generate"] = "prisma generate";
      scripts["db:push"] = "prisma db push";
      scripts["db:migrate"] = "prisma migrate dev";
    }

    if (config.orm === "drizzle") {
      scripts["db:generate"] = "drizzle-kit generate";
      scripts["db:push"] = "drizzle-kit push";
    }

    return scripts;
  }

  getDependencies(config: ProjectConfig): Record<string, string> {
    return {
      fastify: "^5.1.0",
      "@fastify/cors": "^10.0.0",
      "@fastify/helmet": "^12.0.0",
      ...this.getCommonDependencies(config),
    };
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    return {
      ...this.getCommonDevDependencies(config),
    };
  }

  private getEntryFile(_config: ProjectConfig): string {
    return `import "dotenv/config";
import { buildApp } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(\`Server running on http://localhost:\${PORT}\`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
`;
  }

  private getAppFile(_config: ProjectConfig): string {
    return `import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";
import { itemRoutes } from "./routes/items.js";
import { logger } from "./utils/logger.js";

export async function buildApp() {
  const app = Fastify({
    logger: logger,
  });

  // Plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  });

  // Routes
  await app.register(healthRoutes, { prefix: "/api/health" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(itemRoutes, { prefix: "/api/items" });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, path: request.url }, "Error occurred");

    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.validation,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode === 500 && process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error.message,
      },
    });
  });

  return app;
}
`;
  }

  private getHealthRoute(): string {
    return `import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));
};
`;
  }

  private getUserRoutes(_config: ProjectConfig): string {
    return `import { FastifyPluginAsync } from "fastify";
import { createUserSchema, updateUserSchema, paginationSchema } from "../schemas/index.js";

const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

export const userRoutes: FastifyPluginAsync = async (app) => {
  // GET /users
  app.get("/", async (request) => {
    const query = paginationSchema.parse(request.query);
    const allUsers = Array.from(users.values());
    const start = (query.page - 1) * query.limit;
    return {
      data: allUsers.slice(start, start + query.limit),
      meta: { total: allUsers.length, page: query.page, limit: query.limit },
    };
  });

  // GET /users/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const user = users.get(request.params.id);
    if (!user) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    return { data: user };
  });

  // POST /users
  app.post("/", async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const id = crypto.randomUUID();
    const user = { id, ...body, createdAt: new Date() };
    users.set(id, user);
    return reply.status(201).send({ data: user });
  });

  // PUT /users/:id
  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const user = users.get(request.params.id);
    if (!user) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    const body = updateUserSchema.parse(request.body);
    const updated = { ...user, ...body };
    users.set(request.params.id, updated);
    return { data: updated };
  });

  // DELETE /users/:id
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!users.delete(request.params.id)) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return reply.status(204).send();
  });
};
`;
  }

  private getItemRoutes(_config: ProjectConfig): string {
    return `import { FastifyPluginAsync } from "fastify";
import { createItemSchema, updateItemSchema, paginationSchema } from "../schemas/index.js";

const items = new Map<string, { id: string; title: string; description?: string; status: string; createdAt: Date }>();

export const itemRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const query = paginationSchema.parse(request.query);
    const allItems = Array.from(items.values());
    const start = (query.page - 1) * query.limit;
    return {
      data: allItems.slice(start, start + query.limit),
      meta: { total: allItems.length, page: query.page, limit: query.limit },
    };
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const item = items.get(request.params.id);
    if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Item not found" } });
    return { data: item };
  });

  app.post("/", async (request, reply) => {
    const body = createItemSchema.parse(request.body);
    const id = crypto.randomUUID();
    const item = { id, ...body, status: body.status || "draft", createdAt: new Date() };
    items.set(id, item);
    return reply.status(201).send({ data: item });
  });

  app.put<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const item = items.get(request.params.id);
    if (!item) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Item not found" } });
    const body = updateItemSchema.parse(request.body);
    const updated = { ...item, ...body };
    items.set(request.params.id, updated);
    return { data: updated };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (!items.delete(request.params.id)) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Item not found" } });
    }
    return reply.status(204).send();
  });
};
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
