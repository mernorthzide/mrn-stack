import { Command } from "commander";
import { runPrompts } from "./prompts/index.js";
import { generate } from "./generators/index.js";
import { banner, logger } from "./utils/logger.js";
import type {
  Framework,
  Database,
  Auth,
  Styling,
  PackageManager,
  ProjectConfig,
} from "./types/config.js";

interface CLIOptions {
  framework?: Framework;
  db?: Database;
  auth?: Auth;
  styling?: Styling;
  pm?: PackageManager;
  typescript?: boolean;
  eslint?: boolean;
  docker?: boolean;
  testing?: boolean;
  playwright?: boolean;
  yes?: boolean;
}

export async function cli() {
  const program = new Command();

  program
    .name("create-mrn-app")
    .description("Scaffold modern full-stack applications")
    .version("0.1.0")
    .argument("[project-name]", "Name of the project")
    .option("-f, --framework <framework>", "Framework: next, react, vue, astro")
    .option(
      "-d, --db <database>",
      "Database: supabase, convex, neon, sqlite, turso, planetscale, none"
    )
    .option(
      "-a, --auth <auth>",
      "Auth: next-auth, clerk, supabase-auth, better-auth, none"
    )
    .option(
      "-s, --styling <styling>",
      "Styling: tailwind, tailwind-shadcn, css-modules, vanilla"
    )
    .option("-p, --pm <pm>", "Package manager: npm, pnpm, bun")
    .option("--typescript", "Use TypeScript (default: true)", true)
    .option("--no-typescript", "Disable TypeScript")
    .option("--eslint", "Add ESLint + Prettier (default: true)", true)
    .option("--no-eslint", "Skip ESLint")
    .option("--docker", "Add Docker support")
    .option("--testing", "Add testing setup (Vitest)")
    .option("--playwright", "Add Playwright E2E testing")
    .option("-y, --yes", "Skip prompts and use defaults")
    .action(async (projectName: string | undefined, options: CLIOptions) => {
      banner();

      try {
        let config: ProjectConfig;

        if (options.yes && projectName) {
          // Use defaults with provided project name
          config = {
            projectName,
            framework: options.framework || "next",
            database: options.db || "none",
            auth: options.auth || "none",
            styling: options.styling || "tailwind",
            packageManager: options.pm || "pnpm",
            extras: {
              typescript: options.typescript ?? true,
              eslint: options.eslint ?? true,
              prettier: options.eslint ?? true,
              testing: options.testing ?? false,
              playwright: options.playwright ?? false,
              docker: options.docker ?? false,
            },
          };
        } else if (hasAllFlags(options) && projectName) {
          // All flags provided
          config = {
            projectName,
            framework: options.framework!,
            database: options.db!,
            auth: options.auth!,
            styling: options.styling!,
            packageManager: options.pm!,
            extras: {
              typescript: options.typescript ?? true,
              eslint: options.eslint ?? true,
              prettier: options.eslint ?? true,
              testing: options.testing ?? false,
              playwright: options.playwright ?? false,
              docker: options.docker ?? false,
            },
          };
        } else {
          // Interactive mode
          config = await runPrompts({
            projectName,
            framework: options.framework,
            database: options.db,
            auth: options.auth,
            styling: options.styling,
            packageManager: options.pm,
          });
        }

        await generate(config);
      } catch (error) {
        if (error instanceof Error && error.message === "CANCELLED") {
          logger.warn("Operation cancelled");
          process.exit(0);
        }
        logger.error(error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
      }
    });

  program.parse();
}

function hasAllFlags(options: CLIOptions): boolean {
  return !!(
    options.framework &&
    options.db &&
    options.auth &&
    options.styling &&
    options.pm
  );
}
