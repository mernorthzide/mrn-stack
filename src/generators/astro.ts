import { BaseGenerator } from "./base.js";
import type { ProjectConfig } from "../types/config.js";

export class AstroGenerator extends BaseGenerator {
  framework = "astro";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Write package.json
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));

    // Write tsconfig.json
    if (config.extras.typescript) {
      await this.writeJSON(projectPath, "tsconfig.json", this.getAstroTSConfig());
    }

    // Write astro.config
    await this.writeFile(
      projectPath,
      `astro.config.${config.extras.typescript ? "ts" : "mjs"}`,
      this.getAstroConfig(config)
    );

    // Write .gitignore
    await this.writeFile(projectPath, ".gitignore", this.getGitignore());

    // Write .env.example
    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".env", this.getEnvExample(config));

    // Write ESLint config
    if (config.extras.eslint) {
      await this.writeJSON(projectPath, ".eslintrc.json", this.getAstroESLintConfig());
      await this.writeJSON(projectPath, ".prettierrc", this.getPrettierConfig());
    }

    // Write Tailwind config
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      await this.writeFile(projectPath, "tailwind.config.mjs", this.getAstroTailwindConfig());
    }

    // Write source files
    await this.writeSourceFiles(projectPath, config);

    // Write Docker files
    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getAstroDockerfile());
      await this.writeFile(projectPath, "docker-compose.yml", this.getDockerCompose(config));
    }

    // Write AI config files (Cursor + Claude)
    await this.writeAIConfigFiles(projectPath, config);

    // Write Playwright config
    if (config.extras.playwright) {
      await this.writeFile(projectPath, "playwright.config.ts", this.getPlaywrightConfig(config));
      await this.writeFile(projectPath, "e2e/example.spec.ts", this.getPlaywrightExampleTest(config));
    }
  }

  private async writeSourceFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    // src/pages/index.astro
    await this.writeFile(projectPath, "src/pages/index.astro", this.getIndexPage(config));

    // src/layouts/Layout.astro
    await this.writeFile(projectPath, "src/layouts/Layout.astro", this.getLayout(config));

    // src/styles/global.css
    await this.writeFile(projectPath, "src/styles/global.css", this.getGlobalCSS(config));

    // public folder
    await this.writeFile(projectPath, "public/.gitkeep", "");

    // components folder
    await this.writeFile(projectPath, "src/components/.gitkeep", "");

    // Write database files
    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "ts" : "js";

    switch (config.database) {
      case "supabase":
        await this.writeFile(
          projectPath,
          `src/lib/supabase.${ext}`,
          this.getSupabaseClient()
        );
        break;
    }
  }

  protected getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {
      dev: "astro dev",
      build: "astro build",
      preview: "astro preview",
      astro: "astro",
    };

    if (config.extras.eslint) {
      scripts.lint = "eslint .";
    }

    if (config.extras.playwright) {
      scripts["test:e2e"] = "playwright test";
      scripts["test:e2e:ui"] = "playwright test --ui";
    }

    return scripts;
  }

  protected getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      astro: "^5.1.0",
    };

    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      deps["@astrojs/tailwind"] = "^5.1.0";
      deps["tailwindcss"] = "^3.4.0";
    }

    // Database
    switch (config.database) {
      case "supabase":
        deps["@supabase/supabase-js"] = "^2.47.0";
        break;
    }

    // Auth
    switch (config.auth) {
      case "clerk":
        deps["@clerk/astro"] = "^1.4.0";
        break;
    }

    return deps;
  }

  protected getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {};

    if (config.extras.typescript) {
      devDeps["typescript"] = "^5.7.0";
    }

    if (config.extras.eslint) {
      devDeps["eslint"] = "^9.17.0";
      devDeps["eslint-plugin-astro"] = "^1.3.0";
      devDeps["prettier"] = "^3.4.0";
      devDeps["prettier-plugin-astro"] = "^0.14.0";
    }

    if (config.extras.playwright) {
      devDeps["@playwright/test"] = "^1.49.0";
    }

    return devDeps;
  }

  protected getTailwindContentPaths(): string[] {
    return ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"];
  }

  private getAstroTSConfig(): object {
    return {
      extends: "astro/tsconfigs/strict",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["src/*"],
        },
      },
    };
  }

  private getAstroConfig(config: ProjectConfig): string {
    const imports: string[] = [`import { defineConfig } from "astro/config";`];
    const integrations: string[] = [];

    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      imports.push(`import tailwind from "@astrojs/tailwind";`);
      integrations.push("tailwind()");
    }

    if (config.auth === "clerk") {
      imports.push(`import clerk from "@clerk/astro";`);
      integrations.push("clerk()");
    }

    return `${imports.join("\n")}

export default defineConfig({
  integrations: [${integrations.join(", ")}],
});
`;
  }

  private getAstroESLintConfig(): object {
    return {
      extends: ["plugin:astro/recommended"],
      overrides: [
        {
          files: ["*.astro"],
          parser: "astro-eslint-parser",
        },
      ],
    };
  }

  private getAstroTailwindConfig(): string {
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
  }

  private getIndexPage(config: ProjectConfig): string {
    const hasTailwind = config.styling === "tailwind" || config.styling === "tailwind-shadcn";

    return `---
import Layout from "../layouts/Layout.astro";
---

<Layout title="${config.projectName}">
  <main${hasTailwind ? ` class="flex min-h-screen flex-col items-center justify-center p-24"` : ""}>
    <h1${hasTailwind ? ` class="text-4xl font-bold"` : ""}>
      Welcome to ${config.projectName}
    </h1>
    <p${hasTailwind ? ` class="mt-4 text-gray-600"` : ""}>
      Created with create-mrn-app
    </p>
  </main>
</Layout>
`;
  }

  private getLayout(config: ProjectConfig): string {
    const hasTailwind = config.styling === "tailwind" || config.styling === "tailwind-shadcn";

    return `---
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="generator" content={Astro.generator} />
    <title>{title}</title>
  </head>
  <body${hasTailwind ? "" : ` class="min-h-screen"`}>
    <slot />
  </body>
</html>
${hasTailwind ? "" : `
<style is:global>
  @import "../styles/global.css";
</style>
`}`;
  }

  private getGlobalCSS(config: ProjectConfig): string {
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      return this.getTailwindCSS();
    }

    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

body {
  min-height: 100vh;
}
`;
  }

  private getAstroDockerfile(): string {
    return `FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private getSupabaseClient(): string {
    return `import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;
  }

  private getPlaywrightConfig(config: ProjectConfig): string {
    return `import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
`;
  }

  private getPlaywrightExampleTest(config: ProjectConfig): string {
    return `import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/${config.projectName}/);
});

test("has welcome heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
});
`;
  }
}
