export type Framework = "next" | "react" | "vue" | "astro";

export type BackendFramework =
  | "none"
  | "nextjs-builtin"
  | "express"
  | "fastify"
  | "nestjs"
  | "hono"
  | "elysia"
  | "convex";

export type Database =
  | "supabase"
  | "convex"
  | "neon"
  | "sqlite"
  | "turso"
  | "planetscale"
  | "mongodb"
  | "none";

export type ORM = "prisma" | "drizzle" | "none";

export type HonoRuntime = "node" | "bun";

export type Auth =
  | "next-auth"
  | "clerk"
  | "supabase-auth"
  | "better-auth"
  | "none";

export type Styling =
  | "tailwind"
  | "tailwind-shadcn"
  | "css-modules"
  | "vanilla";

export type PackageManager = "npm" | "pnpm" | "bun";

export interface ProjectConfig {
  projectName: string;
  framework: Framework;
  backend: BackendFramework;
  database: Database;
  orm: ORM;
  auth: Auth;
  styling: Styling;
  packageManager: PackageManager;
  runtime?: HonoRuntime;
  extras: {
    typescript: boolean;
    eslint: boolean;
    prettier: boolean;
    testing: boolean;
    playwright: boolean;
    docker: boolean;
  };
}

export interface FrameworkOption {
  value: Framework;
  label: string;
  hint: string;
}

export interface DatabaseOption {
  value: Database;
  label: string;
  hint: string;
}

export interface AuthOption {
  value: Auth;
  label: string;
  hint: string;
}

export interface StylingOption {
  value: Styling;
  label: string;
  hint: string;
}

export interface PackageManagerOption {
  value: PackageManager;
  label: string;
  hint: string;
}

export interface BackendOption {
  value: BackendFramework;
  label: string;
  hint: string;
}

export interface ORMOption {
  value: ORM;
  label: string;
  hint: string;
}

// Framework compatibility matrix
export const FRAMEWORK_AUTH_COMPAT: Record<Framework, Auth[]> = {
  next: ["next-auth", "clerk", "supabase-auth", "better-auth", "none"],
  react: ["clerk", "supabase-auth", "better-auth", "none"],
  vue: ["clerk", "supabase-auth", "better-auth", "none"],
  astro: ["clerk", "supabase-auth", "better-auth", "none"],
};

export const FRAMEWORK_DB_COMPAT: Record<Framework, Database[]> = {
  next: ["supabase", "convex", "neon", "sqlite", "turso", "planetscale", "mongodb", "none"],
  react: ["supabase", "convex", "neon", "sqlite", "turso", "planetscale", "mongodb", "none"],
  vue: ["supabase", "neon", "sqlite", "turso", "planetscale", "mongodb", "none"],
  astro: ["supabase", "neon", "sqlite", "turso", "planetscale", "mongodb", "none"],
};

// Backend framework compatibility matrix
export const FRAMEWORK_BACKEND_COMPAT: Record<Framework, BackendFramework[]> = {
  next: ["none", "nextjs-builtin", "express", "fastify", "nestjs", "hono", "elysia", "convex"],
  react: ["none", "express", "fastify", "nestjs", "hono", "elysia", "convex"],
  vue: ["none", "express", "fastify", "nestjs", "hono", "elysia"],
  astro: ["none", "express", "fastify", "nestjs", "hono", "elysia"],
};

// ORM compatibility matrix based on database
export const DATABASE_ORM_COMPAT: Record<Database, ORM[]> = {
  mongodb: ["prisma"],
  supabase: ["prisma", "drizzle"],
  neon: ["prisma", "drizzle"],
  sqlite: ["prisma", "drizzle"],
  turso: ["prisma", "drizzle"],
  planetscale: ["prisma", "drizzle"],
  convex: ["none"],
  none: ["none"],
};

// Backend frameworks that require Bun runtime
export const BUN_ONLY_BACKENDS: BackendFramework[] = ["elysia"];

// Backend frameworks that allow runtime selection
export const RUNTIME_SELECTABLE_BACKENDS: BackendFramework[] = ["hono"];

// Backend frameworks that skip database prompt
export const SKIP_DB_BACKENDS: BackendFramework[] = ["convex", "none"];
