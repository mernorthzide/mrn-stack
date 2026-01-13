import { BaseGenerator } from "./base.js";
import type { ProjectConfig } from "../types/config.js";

export class ReactGenerator extends BaseGenerator {
  framework = "react";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Write package.json
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));

    // Write tsconfig.json
    if (config.extras.typescript) {
      await this.writeJSON(projectPath, "tsconfig.json", this.getReactTSConfig());
      await this.writeJSON(projectPath, "tsconfig.node.json", this.getNodeTSConfig());
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
      await this.writeFile(
        projectPath,
        "eslint.config.js",
        this.getReactESLintConfig(config)
      );
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
      await this.writeFile(projectPath, "Dockerfile", this.getReactDockerfile());
      await this.writeFile(projectPath, "docker-compose.yml", this.getDockerCompose(config));
    }

    // Write testing config
    if (config.extras.testing) {
      await this.writeFile(projectPath, "vitest.config.ts", this.getVitestConfig(config));
    }
  }

  private async writeSourceFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "tsx" : "jsx";
    const styleExt = config.styling === "css-modules" ? "module.css" : "css";

    // src/main.tsx
    await this.writeFile(projectPath, `src/main.${ext}`, this.getMainFile(config));

    // src/App.tsx
    await this.writeFile(projectPath, `src/App.${ext}`, this.getAppFile(config));

    // src/App.css or src/index.css
    await this.writeFile(projectPath, "src/index.css", this.getIndexCSS(config));

    // src/vite-env.d.ts
    if (config.extras.typescript) {
      await this.writeFile(projectPath, "src/vite-env.d.ts", this.getViteEnvDts());
    }

    // public folder
    await this.writeFile(projectPath, "public/.gitkeep", "");

    // components folder
    await this.writeFile(projectPath, "src/components/.gitkeep", "");

    // lib folder
    await this.writeFile(projectPath, "src/lib/.gitkeep", "");

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
      case "convex":
        await this.writeFile(projectPath, "convex/_generated/.gitkeep", "");
        await this.writeFile(
          projectPath,
          `convex/schema.${ext}`,
          this.getConvexSchema()
        );
        await this.writeFile(
          projectPath,
          `src/lib/convex.${ext}x`,
          this.getConvexProvider(config)
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

    if (config.extras.eslint) {
      scripts.lint = "eslint .";
    }

    if (config.extras.testing) {
      scripts.test = "vitest";
      scripts["test:ui"] = "vitest --ui";
    }

    if (config.database === "convex") {
      scripts.dev = "convex dev --once && vite";
      scripts.convex = "convex dev";
    }

    return scripts;
  }

  protected getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    };

    // Database
    switch (config.database) {
      case "supabase":
        deps["@supabase/supabase-js"] = "^2.47.0";
        break;
      case "convex":
        deps["convex"] = "^1.17.0";
        break;
    }

    // Auth
    switch (config.auth) {
      case "clerk":
        deps["@clerk/clerk-react"] = "^5.18.0";
        break;
      case "better-auth":
        deps["better-auth"] = "^1.1.0";
        break;
    }

    return deps;
  }

  protected getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {
      vite: "^6.0.0",
      "@vitejs/plugin-react": "^4.3.0",
    };

    if (config.extras.typescript) {
      devDeps["typescript"] = "^5.7.0";
      devDeps["@types/react"] = "^19.0.0";
      devDeps["@types/react-dom"] = "^19.0.0";
    }

    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      devDeps["tailwindcss"] = "^3.4.0";
      devDeps["postcss"] = "^8.4.0";
      devDeps["autoprefixer"] = "^10.4.0";
    }

    if (config.extras.eslint) {
      devDeps["eslint"] = "^9.17.0";
      devDeps["@eslint/js"] = "^9.17.0";
      devDeps["eslint-plugin-react-hooks"] = "^5.1.0";
      devDeps["eslint-plugin-react-refresh"] = "^0.4.0";
      devDeps["globals"] = "^15.0.0";
      devDeps["prettier"] = "^3.4.0";
      if (config.extras.typescript) {
        devDeps["typescript-eslint"] = "^8.18.0";
      }
    }

    if (config.extras.testing) {
      devDeps["vitest"] = "^2.1.0";
      devDeps["@testing-library/react"] = "^16.1.0";
      devDeps["jsdom"] = "^25.0.0";
    }

    return devDeps;
  }

  protected getTailwindContentPaths(): string[] {
    return ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"];
  }

  private getReactTSConfig(): object {
    return {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          "@/*": ["./src/*"],
        },
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }],
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

  private getViteConfig(config: ProjectConfig): string {
    return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
  }

  private getReactESLintConfig(config: ProjectConfig): string {
    if (config.extras.typescript) {
      return `import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  }
);
`;
    }

    return `import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist"] },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
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
    <div id="root"></div>
    <script type="module" src="/src/main.${config.extras.typescript ? "tsx" : "jsx"}"></script>
  </body>
</html>
`;
  }

  private getMainFile(config: ProjectConfig): string {
    let imports = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
`;

    let wrapStart = "";
    let wrapEnd = "";

    if (config.auth === "clerk") {
      imports += `import { ClerkProvider } from "@clerk/clerk-react";\n`;
      wrapStart = `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      `;
      wrapEnd = `
    </ClerkProvider>`;
    }

    if (config.database === "convex") {
      imports += `import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
`;
      if (wrapStart) {
        wrapStart += `<ConvexProvider client={convex}>
        `;
        wrapEnd = `
      </ConvexProvider>` + wrapEnd;
      } else {
        wrapStart = `<ConvexProvider client={convex}>
      `;
        wrapEnd = `
    </ConvexProvider>`;
      }
    }

    return `${imports}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    ${wrapStart}<App />${wrapEnd}
  </StrictMode>
);
`;
  }

  private getAppFile(config: ProjectConfig): string {
    const hasTailwind = config.styling === "tailwind" || config.styling === "tailwind-shadcn";

    return `function App() {
  return (
    <main className="${hasTailwind ? "flex min-h-screen flex-col items-center justify-center p-24" : ""}">
      <h1 className="${hasTailwind ? "text-4xl font-bold" : ""}">
        Welcome to ${config.projectName}
      </h1>
      <p className="${hasTailwind ? "mt-4 text-gray-600" : ""}">
        Created with create-mrn-app
      </p>
    </main>
  );
}

export default App;
`;
  }

  private getIndexCSS(config: ProjectConfig): string {
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

  private getVitestConfig(config: ProjectConfig): string {
    return `import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
  }

  private getReactDockerfile(): string {
    return `FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Production - serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  // Database helpers
  private getSupabaseClient(): string {
    return `import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;
  }

  private getConvexSchema(): string {
    return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Define your tables here
});
`;
  }

  private getConvexProvider(config: ProjectConfig): string {
    return `import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
`;
  }
}
