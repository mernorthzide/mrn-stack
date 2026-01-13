import path from "path";
import fs from "fs-extra";
import type { ProjectConfig, BackendFramework } from "../../types/config.js";

/**
 * Convex generator - Backend-as-a-Service
 * Unlike other backend generators, Convex files live in the frontend project
 * in a `convex/` directory, not a separate backend package.
 */
export class ConvexGenerator {
  framework: BackendFramework = "convex";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Convex schema and functions
    await this.writeFile(projectPath, "convex/schema.ts", this.getSchema());
    await this.writeFile(projectPath, "convex/users.ts", this.getUsersFunctions());
    await this.writeFile(projectPath, "convex/items.ts", this.getItemsFunctions());

    // Convex configuration
    await this.writeJSON(projectPath, "convex.json", this.getConvexConfig());

    // Env example
    await this.writeFile(projectPath, ".env.local.example", this.getEnvExample());

    // Add Convex provider to React/Next.js app
    await this.writeFile(projectPath, "convex/convex-provider.tsx", this.getConvexProvider(config));
  }

  getScripts(): Record<string, string> {
    return {
      "convex:dev": "convex dev",
      "convex:deploy": "convex deploy",
      "convex:codegen": "convex codegen",
    };
  }

  getDependencies(): Record<string, string> {
    return {
      convex: "^1.17.0",
    };
  }

  getDevDependencies(): Record<string, string> {
    return {};
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

  private async writeJSON(
    projectPath: string,
    filePath: string,
    data: object
  ): Promise<void> {
    await this.writeFile(projectPath, filePath, JSON.stringify(data, null, 2));
  }

  private getConvexConfig(): object {
    return {
      functions: "convex/",
      authInfo: [],
    };
  }

  private getSchema(): string {
    return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  items: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived")
    ),
    userId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});
`;
  }

  private getUsersFunctions(): string {
    return `import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// List all users with pagination
export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;

    const users = await ctx.db
      .query("users")
      .order("desc")
      .collect();

    const total = users.length;
    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + limit);

    return {
      data: paginatedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
});

// Get a single user by ID
export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    return user;
  },
});

// Create a new user
export const create = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      password: args.password,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(userId);
  },
});

// Update a user
export const update = mutation({
  args: {
    id: v.id("users"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("User not found");
    }

    // Check if email is being updated and already exists
    if (updates.email && updates.email !== existing.email) {
      const emailExists = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", updates.email!))
        .first();

      if (emailExists) {
        throw new Error("User with this email already exists");
      }
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

// Delete a user
export const remove = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("User not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
`;
  }

  private getItemsFunctions(): string {
    return `import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// List all items with pagination
export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 10;

    let itemsQuery = ctx.db.query("items");

    if (args.status) {
      itemsQuery = itemsQuery.withIndex("by_status", (q) =>
        q.eq("status", args.status!)
      );
    }

    const items = await itemsQuery.order("desc").collect();

    const total = items.length;
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return {
      data: paginatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
});

// Get a single item by ID
export const get = query({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }
    return item;
  },
});

// Get items by user
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return items;
  },
});

// Create a new item
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      )
    ),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const itemId = await ctx.db.insert("items", {
      title: args.title,
      description: args.description,
      status: args.status ?? "draft",
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(itemId);
  },
});

// Update an item
export const update = mutation({
  args: {
    id: v.id("items"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

// Delete an item
export const remove = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
`;
  }

  private getEnvExample(): string {
    return `# Convex
# Get these from https://dashboard.convex.dev
CONVEX_DEPLOYMENT=your-deployment-url
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
`;
  }

  private getConvexProvider(config: ProjectConfig): string {
    if (config.framework === "next") {
      return `"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`;
    }

    // React SPA
    return `import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`;
  }
}
