import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  ProjectConfig,
  Framework,
  BackendFramework,
  Database,
  ORM,
  HonoRuntime,
  Auth,
  Styling,
  PackageManager,
} from "../types/config.js";
import {
  FRAMEWORK_AUTH_COMPAT,
  FRAMEWORK_DB_COMPAT,
  FRAMEWORK_BACKEND_COMPAT,
  DATABASE_ORM_COMPAT,
  BUN_ONLY_BACKENDS,
  RUNTIME_SELECTABLE_BACKENDS,
  SKIP_DB_BACKENDS,
} from "../types/config.js";
import { checkBunInstalled } from "../utils/runtime.js";

interface PromptOptions {
  projectName?: string;
  framework?: Framework;
  backend?: BackendFramework;
  database?: Database;
  orm?: ORM;
  auth?: Auth;
  styling?: Styling;
  packageManager?: PackageManager;
  runtime?: HonoRuntime;
}

export async function runPrompts(options: PromptOptions): Promise<ProjectConfig> {
  p.intro(pc.bgCyan(pc.black(" create-mrn-app ")));

  const projectName =
    options.projectName ||
    ((await p.text({
      message: "What is your project name?",
      placeholder: "my-app (or . for current directory)",
      defaultValue: "my-app",
      validate: (value) => {
        if (!value) return "Project name is required";
        if (value === ".") return undefined;
        if (!/^[a-z0-9-_]+$/i.test(value)) {
          return "Project name can only contain letters, numbers, hyphens, and underscores";
        }
        return undefined;
      },
    })) as string);

  if (p.isCancel(projectName)) {
    throw new Error("CANCELLED");
  }

  const framework =
    options.framework ||
    ((await p.select({
      message: "Which frontend framework would you like to use?",
      options: [
        { value: "next", label: "Next.js", hint: "React framework with App Router" },
        { value: "react", label: "React", hint: "Vite-powered React SPA" },
        { value: "vue", label: "Vue", hint: "Vite-powered Vue 3 SPA" },
        { value: "astro", label: "Astro", hint: "Content-focused with islands" },
      ],
    })) as Framework);

  if (p.isCancel(framework)) {
    throw new Error("CANCELLED");
  }

  // Filter backend options based on frontend framework
  const availableBackends = FRAMEWORK_BACKEND_COMPAT[framework];
  const backend =
    options.backend ||
    ((await p.select({
      message: "Which backend framework would you like to use?",
      options: [
        { value: "none", label: "None", hint: "Frontend only" },
        { value: "nextjs-builtin", label: "Next.js Built-in", hint: "Route Handlers in app/api/" },
        { value: "express", label: "Express", hint: "Minimal, flexible Node.js framework" },
        { value: "fastify", label: "Fastify", hint: "Fast, low overhead web framework" },
        { value: "nestjs", label: "NestJS", hint: "Enterprise-grade, Angular-style" },
        { value: "hono", label: "Hono", hint: "Ultrafast, works with any runtime" },
        { value: "elysia", label: "Elysia", hint: "Bun-native, TypeScript-first" },
        { value: "convex", label: "Convex", hint: "Reactive backend-as-a-service" },
      ].filter((opt) => availableBackends.includes(opt.value as BackendFramework)),
    })) as BackendFramework);

  if (p.isCancel(backend)) {
    throw new Error("CANCELLED");
  }

  // Handle Elysia - requires Bun
  let forcePackageManager: PackageManager | undefined;
  if (BUN_ONLY_BACKENDS.includes(backend)) {
    const bunInstalled = await checkBunInstalled();
    if (!bunInstalled) {
      p.log.warn(
        pc.yellow("⚠️  Elysia requires Bun runtime. Please install Bun: https://bun.sh")
      );
      p.log.info(pc.dim("Run: curl -fsSL https://bun.sh/install | bash"));
    }
    forcePackageManager = "bun";
  }

  // Handle Hono - ask for runtime
  let runtime: HonoRuntime | undefined;
  if (RUNTIME_SELECTABLE_BACKENDS.includes(backend)) {
    runtime =
      options.runtime ||
      ((await p.select({
        message: "Which runtime for Hono?",
        options: [
          { value: "node", label: "Node.js", hint: "Traditional Node.js runtime" },
          { value: "bun", label: "Bun", hint: "Fast all-in-one runtime" },
        ],
      })) as HonoRuntime);

    if (p.isCancel(runtime)) {
      throw new Error("CANCELLED");
    }

    if (runtime === "bun") {
      forcePackageManager = "bun";
    }
  }

  // Database and ORM selection (skip for Convex backend)
  let database: Database = "none";
  let orm: ORM = "none";

  if (!SKIP_DB_BACKENDS.includes(backend)) {
    const availableDBs = FRAMEWORK_DB_COMPAT[framework];
    database =
      options.database ||
      ((await p.select({
        message: "Which database would you like to use?",
        options: [
          { value: "supabase", label: "Supabase", hint: "PostgreSQL + Realtime + Auth" },
          { value: "neon", label: "Neon", hint: "Serverless PostgreSQL" },
          { value: "planetscale", label: "PlanetScale", hint: "MySQL-compatible serverless" },
          { value: "mongodb", label: "MongoDB", hint: "Document database" },
          { value: "sqlite", label: "SQLite", hint: "Local embedded database" },
          { value: "turso", label: "Turso", hint: "Edge SQLite (libSQL)" },
          { value: "none", label: "None", hint: "Skip database setup" },
        ].filter((opt) => availableDBs.includes(opt.value as Database)),
      })) as Database);

    if (p.isCancel(database)) {
      throw new Error("CANCELLED");
    }

    // ORM selection based on database
    if (database !== "none") {
      const availableORMs = DATABASE_ORM_COMPAT[database];
      if (availableORMs.length > 1) {
        orm =
          options.orm ||
          ((await p.select({
            message: "Which ORM would you like to use?",
            options: [
              { value: "prisma", label: "Prisma", hint: "Type-safe ORM with great DX" },
              { value: "drizzle", label: "Drizzle", hint: "Lightweight, SQL-like TypeScript ORM" },
            ].filter((opt) => availableORMs.includes(opt.value as ORM)),
          })) as ORM);

        if (p.isCancel(orm)) {
          throw new Error("CANCELLED");
        }
      } else {
        // Auto-select if only one ORM available (e.g., MongoDB -> Prisma)
        orm = availableORMs[0];
        if (orm !== "none") {
          p.log.info(pc.dim(`Using ${orm} for ${database}`));
        }
      }
    }
  } else if (backend === "convex") {
    p.log.info(pc.dim("Convex includes its own database - skipping database selection"));
  }

  // Filter auth options based on framework
  const availableAuths = FRAMEWORK_AUTH_COMPAT[framework];
  const auth =
    options.auth ||
    ((await p.select({
      message: "Which authentication would you like to use?",
      options: [
        { value: "next-auth", label: "NextAuth / Auth.js", hint: "Flexible, self-hosted" },
        { value: "clerk", label: "Clerk", hint: "Managed auth with UI components" },
        { value: "supabase-auth", label: "Supabase Auth", hint: "Built-in with Supabase" },
        { value: "better-auth", label: "Better Auth", hint: "Modern, flexible auth library" },
        { value: "none", label: "None", hint: "Skip authentication" },
      ].filter((opt) => availableAuths.includes(opt.value as Auth)),
    })) as Auth);

  if (p.isCancel(auth)) {
    throw new Error("CANCELLED");
  }

  const styling =
    options.styling ||
    ((await p.select({
      message: "Which styling solution would you like to use?",
      options: [
        { value: "tailwind", label: "Tailwind CSS", hint: "Utility-first CSS" },
        { value: "tailwind-shadcn", label: "Tailwind + shadcn/ui", hint: "Beautiful components" },
        { value: "css-modules", label: "CSS Modules", hint: "Scoped CSS" },
        { value: "vanilla", label: "Vanilla CSS", hint: "Plain CSS" },
      ],
    })) as Styling);

  if (p.isCancel(styling)) {
    throw new Error("CANCELLED");
  }

  let packageManager: PackageManager;
  if (forcePackageManager) {
    packageManager = forcePackageManager;
    p.log.info(pc.dim(`Using ${forcePackageManager} as package manager (required by ${backend})`));
  } else {
    packageManager =
      options.packageManager ||
      ((await p.select({
        message: "Which package manager would you like to use?",
        options: [
          { value: "pnpm", label: "pnpm", hint: "Fast, disk space efficient (recommended)" },
          { value: "npm", label: "npm", hint: "Node.js default" },
          { value: "bun", label: "bun", hint: "All-in-one JavaScript runtime" },
        ],
      })) as PackageManager);

    if (p.isCancel(packageManager)) {
      throw new Error("CANCELLED");
    }
  }

  const extras = (await p.multiselect({
    message: "Select additional features:",
    options: [
      { value: "typescript", label: "TypeScript", hint: "Type-safe development" },
      { value: "eslint", label: "ESLint + Prettier", hint: "Code quality" },
      { value: "testing", label: "Testing (Vitest)", hint: "Unit & integration tests" },
      { value: "playwright", label: "Playwright", hint: "E2E testing" },
      { value: "docker", label: "Docker", hint: "Container support" },
    ],
    initialValues: ["typescript", "eslint"],
  })) as string[];

  if (p.isCancel(extras)) {
    throw new Error("CANCELLED");
  }

  p.outro(pc.green("Configuration complete! Creating your project..."));

  return {
    projectName,
    framework,
    backend,
    database,
    orm,
    auth,
    styling,
    packageManager,
    runtime,
    extras: {
      typescript: extras.includes("typescript"),
      eslint: extras.includes("eslint"),
      prettier: extras.includes("eslint"),
      testing: extras.includes("testing"),
      playwright: extras.includes("playwright"),
      docker: extras.includes("docker"),
    },
  };
}
