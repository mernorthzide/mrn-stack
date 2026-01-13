import { BaseGenerator } from "./base.js";
import type { ProjectConfig } from "../types/config.js";

export class VueGenerator extends BaseGenerator {
  framework = "vue";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Write package.json
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));

    // Write tsconfig files
    if (config.extras.typescript) {
      await this.writeJSON(projectPath, "tsconfig.json", this.getVueTSConfig());
      await this.writeJSON(projectPath, "tsconfig.node.json", this.getNodeTSConfig());
      await this.writeJSON(projectPath, "tsconfig.app.json", this.getAppTSConfig());
    }

    // Write vite.config
    await this.writeFile(
      projectPath,
      `vite.config.${config.extras.typescript ? "ts" : "js"}`,
      this.getViteConfig(config)
    );

    // Write .gitignore
    await this.writeFile(projectPath, ".gitignore", this.getGitignore());

    // Write .env.example
    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".env.local", this.getEnvExample(config));

    // Write ESLint config
    if (config.extras.eslint) {
      await this.writeFile(projectPath, "eslint.config.js", this.getVueESLintConfig(config));
      await this.writeJSON(projectPath, ".prettierrc", this.getPrettierConfig());
    }

    // Write Tailwind config
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      await this.writeFile(projectPath, "tailwind.config.js", this.getTailwindConfig(config));
      await this.writeFile(projectPath, "postcss.config.js", this.getPostCSSConfig());
    }

    // Write index.html
    await this.writeFile(projectPath, "index.html", this.getIndexHtml(config));

    // Write source files
    await this.writeSourceFiles(projectPath, config);

    // Write Docker files
    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getVueDockerfile());
      await this.writeFile(projectPath, "docker-compose.yml", this.getDockerCompose(config));
    }
  }

  private async writeSourceFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "ts" : "js";

    // src/main.ts
    await this.writeFile(projectPath, `src/main.${ext}`, this.getMainFile(config));

    // src/App.vue
    await this.writeFile(projectPath, "src/App.vue", this.getAppVue(config));

    // src/style.css
    await this.writeFile(projectPath, "src/style.css", this.getStyleCSS(config));

    // env.d.ts
    if (config.extras.typescript) {
      await this.writeFile(projectPath, "src/vite-env.d.ts", this.getViteEnvDts());
    }

    // public folder
    await this.writeFile(projectPath, "public/.gitkeep", "");

    // components folder
    await this.writeFile(projectPath, "src/components/.gitkeep", "");

    // composables folder
    await this.writeFile(projectPath, "src/composables/.gitkeep", "");

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
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    };

    if (config.extras.typescript) {
      scripts["build"] = "vue-tsc -b && vite build";
    }

    if (config.extras.eslint) {
      scripts.lint = "eslint .";
    }

    return scripts;
  }

  protected getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      vue: "^3.5.0",
    };

    // Database
    switch (config.database) {
      case "supabase":
        deps["@supabase/supabase-js"] = "^2.47.0";
        break;
    }

    // Auth
    switch (config.auth) {
      case "clerk":
        deps["vue-clerk"] = "^0.6.0";
        break;
    }

    return deps;
  }

  protected getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {
      vite: "^6.0.0",
      "@vitejs/plugin-vue": "^5.2.0",
    };

    if (config.extras.typescript) {
      devDeps["typescript"] = "^5.7.0";
      devDeps["vue-tsc"] = "^2.2.0";
    }

    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      devDeps["tailwindcss"] = "^3.4.0";
      devDeps["postcss"] = "^8.4.0";
      devDeps["autoprefixer"] = "^10.4.0";
    }

    if (config.extras.eslint) {
      devDeps["eslint"] = "^9.17.0";
      devDeps["eslint-plugin-vue"] = "^9.32.0";
      devDeps["prettier"] = "^3.4.0";
      if (config.extras.typescript) {
        devDeps["@vue/eslint-config-typescript"] = "^14.2.0";
      }
    }

    return devDeps;
  }

  protected getTailwindContentPaths(): string[] {
    return ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"];
  }

  private getVueTSConfig(): object {
    return {
      files: [],
      references: [
        { path: "./tsconfig.node.json" },
        { path: "./tsconfig.app.json" },
      ],
    };
  }

  private getNodeTSConfig(): object {
    return {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: "ESNext",
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true,
        strict: true,
      },
      include: ["vite.config.ts"],
    };
  }

  private getAppTSConfig(): object {
    return {
      compilerOptions: {
        composite: true,
        target: "ES2020",
        useDefineForClassFields: true,
        module: "ESNext",
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "preserve",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
    };
  }

  private getViteConfig(config: ProjectConfig): string {
    return `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
  }

  private getVueESLintConfig(config: ProjectConfig): string {
    return `import pluginVue from "eslint-plugin-vue";

export default [
  ...pluginVue.configs["flat/recommended"],
  {
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
];
`;
  }

  private getPostCSSConfig(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  private getIndexHtml(config: ProjectConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${config.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.${config.extras.typescript ? "ts" : "js"}"></script>
  </body>
</html>
`;
  }

  private getMainFile(config: ProjectConfig): string {
    return `import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";

createApp(App).mount("#app");
`;
  }

  private getAppVue(config: ProjectConfig): string {
    const hasTailwind = config.styling === "tailwind" || config.styling === "tailwind-shadcn";

    return `<script setup${config.extras.typescript ? " lang=\"ts\"" : ""}>
// Component logic here
</script>

<template>
  <main${hasTailwind ? ` class="flex min-h-screen flex-col items-center justify-center p-24"` : ""}>
    <h1${hasTailwind ? ` class="text-4xl font-bold"` : ""}>
      Welcome to ${config.projectName}
    </h1>
    <p${hasTailwind ? ` class="mt-4 text-gray-600"` : ""}>
      Created with create-mrn-app
    </p>
  </main>
</template>
`;
  }

  private getStyleCSS(config: ProjectConfig): string {
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      return this.getTailwindCSS();
    }

    return `:root {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}
`;
  }

  private getViteEnvDts(): string {
    return `/// <reference types="vite/client" />
`;
  }

  private getVueDockerfile(): string {
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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;
  }
}
