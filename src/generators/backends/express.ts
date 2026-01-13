import type { ProjectConfig } from "../../types/config.js";
import { BaseBackendGenerator } from "./base-backend.js";

export class ExpressGenerator extends BaseBackendGenerator {
  framework = "express" as const;

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Write package.json
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));

    // Write TypeScript config
    await this.writeJSON(projectPath, "tsconfig.json", this.getTSConfig());

    // Write source files
    await this.writeFile(projectPath, "src/index.ts", this.getEntryFile(config));
    await this.writeFile(projectPath, "src/app.ts", this.getAppFile(config));

    // Write routes
    await this.writeFile(projectPath, "src/routes/health.ts", this.getHealthRoute());
    await this.writeFile(projectPath, "src/routes/users.ts", this.getUserRoutes(config));
    await this.writeFile(projectPath, "src/routes/items.ts", this.getItemRoutes(config));
    await this.writeFile(projectPath, "src/routes/index.ts", this.getRoutesIndex());

    // Write middleware
    await this.writeFile(projectPath, "src/middleware/error.ts", this.getErrorMiddleware());
    await this.writeFile(projectPath, "src/middleware/validate.ts", this.getValidateMiddleware());

    // Write schemas
    await this.writeFile(projectPath, "src/schemas/index.ts", this.getZodSchemas());

    // Write utils
    await this.writeFile(projectPath, "src/utils/logger.ts", this.getPinoLogger());
    await this.writeFile(projectPath, "src/utils/errors.ts", this.getErrorTypes());

    // Write database files if needed
    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }

    // Write config files
    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".gitignore", this.getBackendGitignore());

    // Write Dockerfile if docker enabled
    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getBackendDockerfile(config));
    }
  }

  getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      lint: "eslint src --ext .ts",
    };

    if (config.orm === "prisma") {
      scripts["db:generate"] = "prisma generate";
      scripts["db:push"] = "prisma db push";
      scripts["db:migrate"] = "prisma migrate dev";
      scripts["db:studio"] = "prisma studio";
    }

    if (config.orm === "drizzle") {
      scripts["db:generate"] = "drizzle-kit generate";
      scripts["db:push"] = "drizzle-kit push";
      scripts["db:migrate"] = "drizzle-kit migrate";
      scripts["db:studio"] = "drizzle-kit studio";
    }

    return scripts;
  }

  getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      express: "^4.21.0",
      cors: "^2.8.5",
      helmet: "^8.0.0",
      pino: "^9.5.0",
      "pino-http": "^10.3.0",
      ...this.getCommonDependencies(config),
    };

    return deps;
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    return {
      "@types/express": "^5.0.0",
      "@types/cors": "^2.8.17",
      "pino-pretty": "^13.0.0",
      ...this.getCommonDevDependencies(config),
    };
  }

  private getEntryFile(_config: ProjectConfig): string {
    return `import "dotenv/config";
import { app } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(\`Server running on http://localhost:\${PORT}\`);
});
`;
  }

  private getAppFile(_config: ProjectConfig): string {
    return `import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/error.js";
import { routes } from "./routes/index.js";

export const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());
app.use(pinoHttp({ logger }));

// Routes
app.use("/api", routes);

// Error handling
app.use(errorHandler);
`;
  }

  private getHealthRoute(): string {
    return `import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export const healthRoutes = router;
`;
  }

  private getUserRoutes(_config: ProjectConfig): string {
    return `import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  userIdSchema,
  paginationSchema,
} from "../schemas/index.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

// In-memory store (replace with database)
const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

// GET /users - List all users
router.get("/", validate(paginationSchema, "query"), async (req, res) => {
  const { page, limit } = req.query as { page: number; limit: number };
  const allUsers = Array.from(users.values());
  const start = (page - 1) * limit;
  const paginatedUsers = allUsers.slice(start, start + limit);

  res.json({
    data: paginatedUsers,
    meta: {
      total: allUsers.length,
      page,
      limit,
      totalPages: Math.ceil(allUsers.length / limit),
    },
  });
});

// GET /users/:id - Get single user
router.get("/:id", validate(userIdSchema, "params"), async (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    throw new NotFoundError("User");
  }
  res.json({ data: user });
});

// POST /users - Create user
router.post("/", validate(createUserSchema), async (req, res) => {
  const { email, name } = req.body;
  const id = crypto.randomUUID();
  const user = { id, email, name, createdAt: new Date() };
  users.set(id, user);
  res.status(201).json({ data: user });
});

// PUT /users/:id - Update user
router.put(
  "/:id",
  validate(userIdSchema, "params"),
  validate(updateUserSchema),
  async (req, res) => {
    const user = users.get(req.params.id);
    if (!user) {
      throw new NotFoundError("User");
    }
    const updated = { ...user, ...req.body };
    users.set(req.params.id, updated);
    res.json({ data: updated });
  }
);

// DELETE /users/:id - Delete user
router.delete("/:id", validate(userIdSchema, "params"), async (req, res) => {
  if (!users.has(req.params.id)) {
    throw new NotFoundError("User");
  }
  users.delete(req.params.id);
  res.status(204).send();
});

export const userRoutes = router;
`;
  }

  private getItemRoutes(_config: ProjectConfig): string {
    return `import { Router } from "express";
import { validate } from "../middleware/validate.js";
import {
  createItemSchema,
  updateItemSchema,
  itemIdSchema,
  paginationSchema,
} from "../schemas/index.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

// In-memory store (replace with database)
const items = new Map<string, {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
}>();

// GET /items - List all items
router.get("/", validate(paginationSchema, "query"), async (req, res) => {
  const { page, limit } = req.query as { page: number; limit: number };
  const allItems = Array.from(items.values());
  const start = (page - 1) * limit;
  const paginatedItems = allItems.slice(start, start + limit);

  res.json({
    data: paginatedItems,
    meta: {
      total: allItems.length,
      page,
      limit,
      totalPages: Math.ceil(allItems.length / limit),
    },
  });
});

// GET /items/:id - Get single item
router.get("/:id", validate(itemIdSchema, "params"), async (req, res) => {
  const item = items.get(req.params.id);
  if (!item) {
    throw new NotFoundError("Item");
  }
  res.json({ data: item });
});

// POST /items - Create item
router.post("/", validate(createItemSchema), async (req, res) => {
  const { title, description, status } = req.body;
  const id = crypto.randomUUID();
  const item = { id, title, description, status: status || "draft", createdAt: new Date() };
  items.set(id, item);
  res.status(201).json({ data: item });
});

// PUT /items/:id - Update item
router.put(
  "/:id",
  validate(itemIdSchema, "params"),
  validate(updateItemSchema),
  async (req, res) => {
    const item = items.get(req.params.id);
    if (!item) {
      throw new NotFoundError("Item");
    }
    const updated = { ...item, ...req.body };
    items.set(req.params.id, updated);
    res.json({ data: updated });
  }
);

// DELETE /items/:id - Delete item
router.delete("/:id", validate(itemIdSchema, "params"), async (req, res) => {
  if (!items.has(req.params.id)) {
    throw new NotFoundError("Item");
  }
  items.delete(req.params.id);
  res.status(204).send();
});

export const itemRoutes = router;
`;
  }

  private getRoutesIndex(): string {
    return `import { Router } from "express";
import { healthRoutes } from "./health.js";
import { userRoutes } from "./users.js";
import { itemRoutes } from "./items.js";

export const routes = Router();

routes.use("/health", healthRoutes);
routes.use("/users", userRoutes);
routes.use("/items", itemRoutes);
`;
  }

  private getErrorMiddleware(): string {
    return `import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error({ err, path: req.path, method: req.method }, "Error occurred");

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    },
  });
}
`;
  }

  private getValidateMiddleware(): string {
    return `import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

type RequestLocation = "body" | "query" | "params";

export function validate(schema: ZodSchema, location: RequestLocation = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[location]);
      req[location] = data;
      next();
    } catch (error) {
      next(error);
    }
  };
}
`;
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    if (config.orm === "prisma") {
      await this.writeFile(projectPath, "prisma/schema.prisma", this.getPrismaSchema(config));
      await this.writeFile(projectPath, "src/db/client.ts", this.getPrismaClient());
    }

    if (config.orm === "drizzle") {
      await this.writeFile(projectPath, "src/db/schema.ts", this.getDrizzleSchema(config));
      await this.writeFile(projectPath, "src/db/client.ts", this.getDrizzleClient(config));
      await this.writeFile(projectPath, "drizzle.config.ts", this.getDrizzleConfig(config));
    }
  }

  private getPrismaClient(): string {
    return `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
`;
  }

  private getDrizzleClient(config: ProjectConfig): string {
    if (config.database === "sqlite" || config.database === "turso") {
      return `import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";

const sqlite = new Database(process.env.DATABASE_URL?.replace("file:", "") || "dev.db");

export const db = drizzle(sqlite, { schema });

export default db;
`;
    }

    if (config.database === "neon" || config.database === "supabase") {
      return `import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export default db;
`;
    }

    if (config.database === "planetscale") {
      return `import { drizzle } from "drizzle-orm/planetscale-serverless";
import { connect } from "@planetscale/database";
import * as schema from "./schema.js";

const connection = connect({
  url: process.env.DATABASE_URL,
});

export const db = drizzle(connection, { schema });

export default db;
`;
    }

    return `// Database client - configure based on your database
export const db = null;
`;
  }
}
