export type Framework = "next" | "react" | "vue" | "astro";

export type Database =
  | "supabase"
  | "convex"
  | "neon"
  | "sqlite"
  | "turso"
  | "planetscale"
  | "none";

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
  database: Database;
  auth: Auth;
  styling: Styling;
  packageManager: PackageManager;
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

// Framework compatibility matrix
export const FRAMEWORK_AUTH_COMPAT: Record<Framework, Auth[]> = {
  next: ["next-auth", "clerk", "supabase-auth", "better-auth", "none"],
  react: ["clerk", "supabase-auth", "better-auth", "none"],
  vue: ["clerk", "supabase-auth", "better-auth", "none"],
  astro: ["clerk", "supabase-auth", "better-auth", "none"],
};

export const FRAMEWORK_DB_COMPAT: Record<Framework, Database[]> = {
  next: ["supabase", "convex", "neon", "sqlite", "turso", "planetscale", "none"],
  react: ["supabase", "convex", "neon", "sqlite", "turso", "planetscale", "none"],
  vue: ["supabase", "neon", "sqlite", "turso", "planetscale", "none"],
  astro: ["supabase", "neon", "sqlite", "turso", "planetscale", "none"],
};
