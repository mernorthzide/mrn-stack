import path from "path";
import fs from "fs-extra";
import type { ProjectConfig, BackendFramework } from "../../types/config.js";

/**
 * Next.js Built-in API generator
 * Uses App Router Route Handlers in app/api/
 * Lives within the Next.js frontend project, not as a separate backend.
 */
export class NextJSAPIGenerator {
  framework: BackendFramework = "nextjs-builtin";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // API Route Handlers
    await this.writeFile(projectPath, "app/api/health/route.ts", this.getHealthRoute());
    await this.writeFile(projectPath, "app/api/users/route.ts", this.getUsersRoute());
    await this.writeFile(projectPath, "app/api/users/[id]/route.ts", this.getUserByIdRoute());
    await this.writeFile(projectPath, "app/api/items/route.ts", this.getItemsRoute());
    await this.writeFile(projectPath, "app/api/items/[id]/route.ts", this.getItemByIdRoute());

    // Shared lib
    await this.writeFile(projectPath, "lib/api/errors.ts", this.getErrorTypes());
    await this.writeFile(projectPath, "lib/api/response.ts", this.getResponseHelpers());
    await this.writeFile(projectPath, "lib/validations/index.ts", this.getValidationSchemas());

    // Database files
    if (config.database !== "none" && config.orm !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }
  }

  getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      zod: "^3.23.0",
    };

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

    return deps;
  }

  getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {};

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

  getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {};

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

  private async writeFile(
    projectPath: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const fullPath = path.join(projectPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, "utf-8");
  }

  private getHealthRoute(): string {
    return `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
`;
  }

  private getUsersRoute(): string {
    return `import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUserSchema, paginationSchema } from "@/lib/validations";
import { jsonResponse, errorResponse } from "@/lib/api/response";

// In-memory store (replace with database)
const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const { page, limit } = query;
    const allUsers = Array.from(users.values());
    const start = (page - 1) * limit;
    const paginatedUsers = allUsers.slice(start, start + limit);

    return jsonResponse({
      data: paginatedUsers,
      meta: {
        total: allUsers.length,
        page,
        limit,
        totalPages: Math.ceil(allUsers.length / limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createUserSchema.parse(body);

    const id = crypto.randomUUID();
    const user = { id, email: data.email, name: data.name, createdAt: new Date() };
    users.set(id, user);

    return jsonResponse({ data: user }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
`;
  }

  private getUserByIdRoute(): string {
    return `import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateUserSchema } from "@/lib/validations";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api/response";

// In-memory store (replace with database)
const users = new Map<string, { id: string; email: string; name: string; createdAt: Date }>();

type Params = { params: Promise<{ id: string }> };

// GET /api/users/[id] - Get single user
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
      return notFoundResponse("User");
    }

    return jsonResponse({ data: user });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = users.get(id);

    if (!user) {
      return notFoundResponse("User");
    }

    const body = await request.json();
    const data = updateUserSchema.parse(body);

    const updated = { ...user, ...data };
    users.set(id, updated);

    return jsonResponse({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!users.has(id)) {
      return notFoundResponse("User");
    }

    users.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
`;
  }

  private getItemsRoute(): string {
    return `import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createItemSchema, paginationSchema } from "@/lib/validations";
import { jsonResponse, errorResponse } from "@/lib/api/response";

// In-memory store (replace with database)
const items = new Map<string, {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
}>();

// GET /api/items - List all items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const { page, limit } = query;
    const allItems = Array.from(items.values());
    const start = (page - 1) * limit;
    const paginatedItems = allItems.slice(start, start + limit);

    return jsonResponse({
      data: paginatedItems,
      meta: {
        total: allItems.length,
        page,
        limit,
        totalPages: Math.ceil(allItems.length / limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/items - Create item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createItemSchema.parse(body);

    const id = crypto.randomUUID();
    const item = {
      id,
      title: data.title,
      description: data.description,
      status: data.status || "draft",
      createdAt: new Date(),
    };
    items.set(id, item);

    return jsonResponse({ data: item }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
`;
  }

  private getItemByIdRoute(): string {
    return `import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateItemSchema } from "@/lib/validations";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api/response";

// In-memory store (replace with database)
const items = new Map<string, {
  id: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
}>();

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id] - Get single item
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const item = items.get(id);

    if (!item) {
      return notFoundResponse("Item");
    }

    return jsonResponse({ data: item });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/items/[id] - Update item
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const item = items.get(id);

    if (!item) {
      return notFoundResponse("Item");
    }

    const body = await request.json();
    const data = updateItemSchema.parse(body);

    const updated = { ...item, ...data };
    items.set(id, updated);

    return jsonResponse({ data: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/items/[id] - Delete item
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!items.has(id)) {
      return notFoundResponse("Item");
    }

    items.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
`;
  }

  private getErrorTypes(): string {
    return `export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = "AppError";
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
`;
  }

  private getResponseHelpers(): string {
    return `import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export function jsonResponse(data: unknown, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.statusCode }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "production"
          ? "Internal server error"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
    },
    { status: 500 }
  );
}

export function notFoundResponse(resource: string = "Resource") {
  return NextResponse.json(
    {
      error: {
        code: "NOT_FOUND",
        message: \`\${resource} not found\`,
      },
    },
    { status: 404 }
  );
}
`;
  }

  private getValidationSchemas(): string {
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

// Query schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
`;
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    if (config.orm === "prisma") {
      await this.writeFile(projectPath, "prisma/schema.prisma", this.getPrismaSchema(config));
      await this.writeFile(projectPath, "lib/db/client.ts", this.getPrismaClient());
    }

    if (config.orm === "drizzle") {
      await this.writeFile(projectPath, "lib/db/schema.ts", this.getDrizzleSchema(config));
      await this.writeFile(projectPath, "lib/db/client.ts", this.getDrizzleClient(config));
      await this.writeFile(projectPath, "drizzle.config.ts", this.getDrizzleConfig(config));
    }
  }

  private getPrismaSchema(config: ProjectConfig): string {
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

  private getDrizzleSchema(config: ProjectConfig): string {
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

  private getDrizzleClient(config: ProjectConfig): string {
    if (config.database === "sqlite" || config.database === "turso") {
      return `import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL?.replace("file:", "") || "dev.db");

export const db = drizzle(sqlite, { schema });

export default db;
`;
    }

    if (config.database === "neon" || config.database === "supabase") {
      return `import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

export default db;
`;
    }

    if (config.database === "planetscale") {
      return `import { drizzle } from "drizzle-orm/planetscale-serverless";
import { connect } from "@planetscale/database";
import * as schema from "./schema";

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

  private getDrizzleConfig(config: ProjectConfig): string {
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
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "${driver === "pg" ? "postgresql" : driver === "mysql2" ? "mysql" : "sqlite"}",
  dbCredentials: {
    ${dbCredentials}
  },
});
`;
  }
}
