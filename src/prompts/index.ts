import * as p from "@clack/prompts";
import pc from "picocolors";
import type {
  ProjectConfig,
  Framework,
  Database,
  Auth,
  Styling,
  PackageManager,
} from "../types/config.js";
import { FRAMEWORK_AUTH_COMPAT, FRAMEWORK_DB_COMPAT } from "../types/config.js";

interface PromptOptions {
  projectName?: string;
  framework?: Framework;
  database?: Database;
  auth?: Auth;
  styling?: Styling;
  packageManager?: PackageManager;
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
        if (value === ".") return undefined; // Allow current directory
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
      message: "Which framework would you like to use?",
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

  // Filter database options based on framework
  const availableDBs = FRAMEWORK_DB_COMPAT[framework];
  const database =
    options.database ||
    ((await p.select({
      message: "Which database would you like to use?",
      options: [
        { value: "supabase", label: "Supabase", hint: "PostgreSQL + Realtime + Auth" },
        { value: "convex", label: "Convex", hint: "Reactive backend-as-a-service" },
        { value: "neon", label: "Neon", hint: "Serverless PostgreSQL" },
        { value: "sqlite", label: "SQLite", hint: "Local embedded database" },
        { value: "turso", label: "Turso", hint: "Edge SQLite (libSQL)" },
        { value: "planetscale", label: "PlanetScale", hint: "MySQL-compatible serverless" },
        { value: "none", label: "None", hint: "Skip database setup" },
      ].filter((opt) => availableDBs.includes(opt.value as Database)),
    })) as Database);

  if (p.isCancel(database)) {
    throw new Error("CANCELLED");
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

  const packageManager =
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
    database,
    auth,
    styling,
    packageManager,
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
