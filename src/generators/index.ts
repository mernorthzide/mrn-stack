import * as p from "@clack/prompts";
import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import type { ProjectConfig } from "../types/config.js";
import { NextGenerator } from "./next.js";
import { ReactGenerator } from "./react.js";
import { VueGenerator } from "./vue.js";
import { AstroGenerator } from "./astro.js";
import { installDependencies } from "../utils/package-manager.js";
import { initGit } from "../utils/git.js";

export async function generate(config: ProjectConfig): Promise<void> {
  // Handle "." for current directory
  const isCurrentDir = config.projectName === ".";
  const projectPath = isCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), config.projectName);

  // Get actual project name from folder for package.json
  const actualProjectName = isCurrentDir
    ? path.basename(process.cwd())
    : config.projectName;

  // Update config with actual project name
  const finalConfig = { ...config, projectName: actualProjectName };

  // Check if directory exists and not empty
  if (fs.existsSync(projectPath)) {
    const files = fs.readdirSync(projectPath).filter(
      (f) => !f.startsWith(".") || f === ".env" // Ignore hidden files except .env
    );
    if (files.length > 0) {
      const shouldContinue = await p.confirm({
        message: isCurrentDir
          ? "Current directory is not empty. Continue anyway?"
          : `Directory ${config.projectName} is not empty. Continue anyway?`,
        initialValue: false,
      });

      if (!shouldContinue || p.isCancel(shouldContinue)) {
        throw new Error("CANCELLED");
      }
    }
  }

  const s = p.spinner();

  // Create project directory (skip if current dir)
  if (!isCurrentDir) {
    s.start("Creating project directory...");
    await fs.ensureDir(projectPath);
    s.stop("Project directory created");
  }

  // Generate project files
  s.start("Generating project files...");
  const generator = getGenerator(finalConfig.framework);
  await generator.generate(projectPath, finalConfig);
  s.stop("Project files generated");

  // Install dependencies
  s.start(`Installing dependencies with ${finalConfig.packageManager}...`);
  await installDependencies(projectPath, finalConfig.packageManager);
  s.stop("Dependencies installed");

  // Initialize git (skip if already in git repo)
  const hasGit = fs.existsSync(path.join(projectPath, ".git"));
  if (!hasGit) {
    s.start("Initializing git repository...");
    await initGit(projectPath);
    s.stop("Git repository initialized");
  }

  // Print success message
  console.log("");

  const getStartedSteps = isCurrentDir
    ? `  ${pc.cyan(getRunCommand(finalConfig.packageManager, "dev"))}`
    : `  ${pc.cyan(`cd ${finalConfig.projectName}`)}
  ${pc.cyan(getRunCommand(finalConfig.packageManager, "dev"))}`;

  p.note(
    `${pc.green("Success!")} Created ${pc.cyan(finalConfig.projectName)} at ${pc.dim(projectPath)}

Inside that directory, you can run:

  ${pc.cyan(getRunCommand(finalConfig.packageManager, "dev"))}
    Starts the development server

  ${pc.cyan(getRunCommand(finalConfig.packageManager, "build"))}
    Builds the app for production

  ${pc.cyan(getRunCommand(finalConfig.packageManager, "start"))}
    Runs the built app in production mode

Get started by running:

${getStartedSteps}`,
    "Next steps"
  );

  console.log("");
}

function getGenerator(framework: string) {
  switch (framework) {
    case "next":
      return new NextGenerator();
    case "react":
      return new ReactGenerator();
    case "vue":
      return new VueGenerator();
    case "astro":
      return new AstroGenerator();
    default:
      throw new Error(`Unknown framework: ${framework}`);
  }
}

function getRunCommand(pm: string, script: string): string {
  switch (pm) {
    case "npm":
      return `npm run ${script}`;
    case "pnpm":
      return `pnpm ${script}`;
    case "bun":
      return `bun ${script}`;
    default:
      return `npm run ${script}`;
  }
}
