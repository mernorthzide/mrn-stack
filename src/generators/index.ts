import * as p from "@clack/prompts";
import path from "path";
import fs from "fs-extra";
import pc from "picocolors";
import type { ProjectConfig } from "../types/config.js";
import { NextGenerator } from "./next.js";
import { ReactGenerator } from "./react.js";
import { VueGenerator } from "./vue.js";
import { AstroGenerator } from "./astro.js";
import {
  getBackendGenerator,
  requiresSeparatePackage,
  integratesWithFrontend,
} from "./backends/index.js";
import { installDependencies } from "../utils/package-manager.js";
import { initGit } from "../utils/git.js";

export async function generate(config: ProjectConfig): Promise<void> {
  // Handle "." for current directory
  const isCurrentDir = config.projectName === ".";
  const projectPath = isCurrentDir
    ? process.cwd()
    : path.resolve(process.cwd(), config.projectName);

  // Get actual project name from folder for package.json (extract basename if full path provided)
  const actualProjectName = isCurrentDir
    ? path.basename(process.cwd())
    : path.basename(config.projectName);

  // Update config with actual project name
  const finalConfig = { ...config, projectName: actualProjectName };

  // Determine project structure
  const isMonorepo = requiresSeparatePackage(finalConfig.backend);
  const isIntegratedBackend = integratesWithFrontend(finalConfig.backend);

  // Check if directory exists and not empty
  if (fs.existsSync(projectPath)) {
    const files = fs.readdirSync(projectPath).filter(
      (f) => !f.startsWith(".") || f === ".env"
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

  if (isMonorepo) {
    // Monorepo structure with packages/frontend and packages/backend
    await generateMonorepoProject(projectPath, finalConfig, s);
  } else {
    // Single project (frontend only, or frontend with integrated backend)
    await generateSingleProject(projectPath, finalConfig, s, isIntegratedBackend);
  }

  // Initialize git (skip if already in git repo)
  const hasGit = fs.existsSync(path.join(projectPath, ".git"));
  if (!hasGit) {
    s.start("Initializing git repository...");
    await initGit(projectPath);
    s.stop("Git repository initialized");
  }

  // Print success message
  console.log("");
  printSuccessMessage(finalConfig, projectPath, isCurrentDir, isMonorepo);
  console.log("");
}

async function generateSingleProject(
  projectPath: string,
  config: ProjectConfig,
  s: ReturnType<typeof p.spinner>,
  isIntegratedBackend: boolean
): Promise<void> {
  // Generate frontend files
  s.start("Generating project files...");
  const generator = getFrontendGenerator(config.framework);
  await generator.generate(projectPath, config);

  // Generate integrated backend files if applicable
  if (isIntegratedBackend) {
    const backendGenerator = getBackendGenerator(config.backend);
    if (backendGenerator) {
      await backendGenerator.generate(projectPath, config);

      // Merge backend dependencies and scripts into frontend package.json
      if ("getDependencies" in backendGenerator) {
        const packageJsonPath = path.join(projectPath, "package.json");
        const packageJson = await fs.readJSON(packageJsonPath);

        // Add dependencies
        const backendDeps = backendGenerator.getDependencies(config);
        packageJson.dependencies = { ...packageJson.dependencies, ...backendDeps };

        // Add dev dependencies
        const backendDevDeps = backendGenerator.getDevDependencies(config);
        packageJson.devDependencies = { ...packageJson.devDependencies, ...backendDevDeps };

        // Add scripts
        if ("getScripts" in backendGenerator) {
          const backendScripts = backendGenerator.getScripts(config);
          packageJson.scripts = { ...packageJson.scripts, ...backendScripts };
        }

        await fs.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
      }
    }
  }
  s.stop("Project files generated");

  // Install dependencies
  s.start(`Installing dependencies with ${config.packageManager}...`);
  await installDependencies(projectPath, config.packageManager);
  s.stop("Dependencies installed");
}

async function generateMonorepoProject(
  projectPath: string,
  config: ProjectConfig,
  s: ReturnType<typeof p.spinner>
): Promise<void> {
  const frontendPath = path.join(projectPath, "packages", "frontend");
  const backendPath = path.join(projectPath, "packages", "backend");

  // Create monorepo structure
  s.start("Setting up monorepo structure...");
  await fs.ensureDir(frontendPath);
  await fs.ensureDir(backendPath);

  // Create root package.json for workspaces
  await createRootPackageJson(projectPath, config);

  // Create workspace config based on package manager
  if (config.packageManager === "pnpm") {
    await createPnpmWorkspace(projectPath);
  }
  s.stop("Monorepo structure created");

  // Generate frontend
  s.start("Generating frontend...");
  const frontendGenerator = getFrontendGenerator(config.framework);
  await frontendGenerator.generate(frontendPath, {
    ...config,
    projectName: "frontend", // Fixed name for pnpm workspace filtering
  });
  s.stop("Frontend generated");

  // Generate backend
  s.start("Generating backend...");
  const backendGenerator = getBackendGenerator(config.backend);
  if (backendGenerator && "generate" in backendGenerator) {
    await backendGenerator.generate(backendPath, {
      ...config,
      projectName: "backend", // Fixed name for pnpm workspace filtering
    });
  }
  s.stop("Backend generated");

  // Generate Docker files if enabled
  if (config.extras.docker) {
    s.start("Generating Docker configuration...");
    await generateDockerCompose(projectPath, config);
    s.stop("Docker configuration generated");
  }

  // Install dependencies from root
  s.start(`Installing dependencies with ${config.packageManager}...`);
  await installDependencies(projectPath, config.packageManager);
  s.stop("Dependencies installed");
}

async function createRootPackageJson(
  projectPath: string,
  config: ProjectConfig
): Promise<void> {
  const rootPackageJson = {
    name: config.projectName,
    version: "0.1.0",
    private: true,
    workspaces: ["packages/*"],
    scripts: {
      dev: "concurrently \"pnpm --filter frontend dev\" \"pnpm --filter backend dev\"",
      "dev:frontend": `${config.packageManager} --filter frontend dev`,
      "dev:backend": `${config.packageManager} --filter backend dev`,
      build: `${config.packageManager} --filter frontend build && ${config.packageManager} --filter backend build`,
      "build:frontend": `${config.packageManager} --filter frontend build`,
      "build:backend": `${config.packageManager} --filter backend build`,
      lint: `${config.packageManager} --filter \"*\" lint`,
      test: `${config.packageManager} --filter \"*\" test`,
    },
    devDependencies: {
      concurrently: "^9.1.0",
    },
  };

  await fs.writeJSON(path.join(projectPath, "package.json"), rootPackageJson, {
    spaces: 2,
  });
}

async function createPnpmWorkspace(projectPath: string): Promise<void> {
  const workspaceYaml = `packages:
  - "packages/*"
`;
  await fs.writeFile(path.join(projectPath, "pnpm-workspace.yaml"), workspaceYaml);
}

async function generateDockerCompose(
  projectPath: string,
  config: ProjectConfig
): Promise<void> {
  let dbService = "";
  let dbDependsOn = "";
  let dbVolume = "";

  // Add database service based on selection
  if (config.database === "mongodb") {
    dbService = `
  db:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - db_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: ${config.projectName}
`;
    dbDependsOn = "\n      - db";
    dbVolume = "\n  db_data:";
  } else if (
    config.database === "supabase" ||
    config.database === "neon" ||
    config.database === "sqlite"
  ) {
    // SQLite doesn't need a service, Supabase/Neon are cloud services
    if (config.database === "sqlite") {
      dbService = "";
    } else {
      dbService = `
  # Note: ${config.database} is a cloud database service
  # Configure DATABASE_URL in your .env file
`;
    }
  } else if (config.database === "planetscale") {
    dbService = `
  # Note: PlanetScale is a cloud database service
  # For local development, you can use MySQL:
  db:
    image: mysql:8
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: ${config.projectName}
`;
    dbDependsOn = "\n      - db";
    dbVolume = "\n  db_data:";
  }

  const dockerCompose = `services:
  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=http://backend:4000/api
    depends_on:
      - backend

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - PORT=4000
      - CORS_ORIGIN=http://localhost:3000
    depends_on:${dbDependsOn || "\n      []"}
${dbService}
volumes:${dbVolume || "\n  {}"}
`;

  await fs.writeFile(path.join(projectPath, "docker-compose.yml"), dockerCompose);

  // Create root .env.example
  let envContent = `# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# Backend
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
`;

  if (config.database === "mongodb") {
    envContent += `
# MongoDB
MONGODB_URI=mongodb://localhost:27017/${config.projectName}
`;
  } else if (config.database !== "none" && config.database !== "sqlite") {
    envContent += `
# Database
DATABASE_URL=your-database-url
`;
  }

  await fs.writeFile(path.join(projectPath, ".env.example"), envContent);
}

function getFrontendGenerator(framework: string) {
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

function printSuccessMessage(
  config: ProjectConfig,
  projectPath: string,
  isCurrentDir: boolean,
  isMonorepo: boolean
): void {
  const pm = config.packageManager;
  const runCmd = (script: string) => getRunCommand(pm, script);

  let message = `${pc.green("Success!")} Created ${pc.cyan(config.projectName)} at ${pc.dim(projectPath)}

Inside that directory, you can run:
`;

  if (isMonorepo) {
    message += `
  ${pc.cyan(runCmd("dev"))}
    Starts both frontend and backend in development mode

  ${pc.cyan(runCmd("dev:frontend"))}
    Starts only the frontend development server

  ${pc.cyan(runCmd("dev:backend"))}
    Starts only the backend development server

  ${pc.cyan(runCmd("build"))}
    Builds both frontend and backend for production
`;

    if (config.extras.docker) {
      message += `
  ${pc.cyan("docker-compose up")}
    Runs the full stack with Docker
`;
    }
  } else {
    message += `
  ${pc.cyan(runCmd("dev"))}
    Starts the development server

  ${pc.cyan(runCmd("build"))}
    Builds the app for production

  ${pc.cyan(runCmd("start"))}
    Runs the built app in production mode
`;
  }

  // Add backend-specific instructions
  if (config.backend === "convex") {
    message += `
  ${pc.cyan(runCmd("convex:dev"))}
    Starts Convex development server
`;
  }

  // Add database instructions
  if (config.orm === "prisma") {
    message += `
  ${pc.cyan(runCmd("db:push"))}
    Push schema changes to database

  ${pc.cyan(runCmd("db:studio"))}
    Open Prisma Studio
`;
  } else if (config.orm === "drizzle") {
    message += `
  ${pc.cyan(runCmd("db:push"))}
    Push schema changes to database

  ${pc.cyan(runCmd("db:studio"))}
    Open Drizzle Studio
`;
  }

  const getStartedSteps = isCurrentDir
    ? `  ${pc.cyan(runCmd("dev"))}`
    : `  ${pc.cyan(`cd ${config.projectName}`)}
  ${pc.cyan(runCmd("dev"))}`;

  message += `
Get started by running:

${getStartedSteps}`;

  p.note(message, "Next steps");
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
