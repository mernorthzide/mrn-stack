import { BaseGenerator } from "./base.js";
import type { ProjectConfig } from "../types/config.js";

export class NextGenerator extends BaseGenerator {
  framework = "next";

  async generate(projectPath: string, config: ProjectConfig): Promise<void> {
    // Write package.json
    await this.writeJSON(projectPath, "package.json", this.getPackageJson(config));

    // Write tsconfig.json
    if (config.extras.typescript) {
      await this.writeJSON(projectPath, "tsconfig.json", this.getNextTSConfig());
    }

    // Write next.config
    await this.writeFile(projectPath, "next.config.ts", this.getNextConfig(config));

    // Write .gitignore
    await this.writeFile(projectPath, ".gitignore", this.getGitignore());

    // Write .env.example
    await this.writeFile(projectPath, ".env.example", this.getEnvExample(config));
    await this.writeFile(projectPath, ".env.local", this.getEnvExample(config));

    // Write ESLint config
    if (config.extras.eslint) {
      await this.writeJSON(projectPath, ".eslintrc.json", this.getNextESLintConfig());
      await this.writeJSON(projectPath, ".prettierrc", this.getPrettierConfig());
    }

    // Write Tailwind config
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      await this.writeFile(projectPath, "tailwind.config.ts", this.getTailwindConfig(config));
      await this.writeFile(projectPath, "postcss.config.mjs", this.getPostCSSConfig());
    }

    // Write app structure
    await this.writeAppFiles(projectPath, config);

    // Write Docker files
    if (config.extras.docker) {
      await this.writeFile(projectPath, "Dockerfile", this.getDockerfile(config));
      await this.writeFile(projectPath, "docker-compose.yml", this.getDockerCompose(config));
    }

    // Write testing config
    if (config.extras.testing) {
      await this.writeFile(projectPath, "vitest.config.ts", this.getVitestConfig());
    }

    // Write AI config files (Cursor + Claude)
    await this.writeAIConfigFiles(projectPath, config);
  }

  private async writeAppFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "tsx" : "jsx";
    const cssExt = config.styling === "css-modules" ? "module.css" : "css";

    // app/layout.tsx
    await this.writeFile(
      projectPath,
      `app/layout.${ext}`,
      this.getLayoutFile(config, ext, cssExt)
    );

    // app/page.tsx
    await this.writeFile(projectPath, `app/page.${ext}`, this.getPageFile(config));

    // app/globals.css
    await this.writeFile(projectPath, `app/globals.css`, this.getGlobalCSS(config));

    // public folder
    await this.writeFile(projectPath, "public/.gitkeep", "");

    // components folder
    await this.writeFile(
      projectPath,
      `components/ui/.gitkeep`,
      ""
    );

    // lib folder
    await this.writeFile(projectPath, "lib/.gitkeep", "");

    // Write database files
    if (config.database !== "none") {
      await this.writeDatabaseFiles(projectPath, config);
    }

    // Write auth files
    if (config.auth !== "none") {
      await this.writeAuthFiles(projectPath, config);
    }
  }

  private async writeDatabaseFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "ts" : "js";

    switch (config.database) {
      case "supabase":
        await this.writeFile(
          projectPath,
          `lib/supabase/client.${ext}`,
          this.getSupabaseClient(config)
        );
        await this.writeFile(
          projectPath,
          `lib/supabase/server.${ext}`,
          this.getSupabaseServer(config)
        );
        break;
      case "convex":
        await this.writeFile(projectPath, "convex/_generated/.gitkeep", "");
        await this.writeFile(
          projectPath,
          `convex/schema.${ext}`,
          this.getConvexSchema()
        );
        break;
      case "neon":
      case "planetscale":
      case "turso":
        await this.writeFile(
          projectPath,
          `lib/db/index.${ext}`,
          this.getDrizzleClient(config)
        );
        await this.writeFile(
          projectPath,
          `lib/db/schema.${ext}`,
          this.getDrizzleSchema()
        );
        break;
    }
  }

  private async writeAuthFiles(projectPath: string, config: ProjectConfig): Promise<void> {
    const ext = config.extras.typescript ? "ts" : "js";

    switch (config.auth) {
      case "next-auth":
        await this.writeFile(
          projectPath,
          `lib/auth.${ext}`,
          this.getNextAuthConfig(config)
        );
        await this.writeFile(
          projectPath,
          `app/api/auth/[...nextauth]/route.${ext}`,
          this.getNextAuthRoute()
        );
        break;
      case "clerk":
        await this.writeFile(projectPath, "middleware.ts", this.getClerkMiddleware());
        break;
      case "better-auth":
        await this.writeFile(
          projectPath,
          `lib/auth.${ext}`,
          this.getBetterAuthConfig(config)
        );
        await this.writeFile(
          projectPath,
          `app/api/auth/[...all]/route.${ext}`,
          this.getBetterAuthRoute()
        );
        break;
    }
  }

  protected getScripts(config: ProjectConfig): Record<string, string> {
    const scripts: Record<string, string> = {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    };

    if (config.extras.testing) {
      scripts.test = "vitest";
      scripts["test:ui"] = "vitest --ui";
    }

    if (config.database === "convex") {
      scripts["dev"] = "convex dev --once && next dev";
      scripts["convex"] = "convex dev";
    }

    return scripts;
  }

  protected getDependencies(config: ProjectConfig): Record<string, string> {
    const deps: Record<string, string> = {
      next: "^15.1.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    };

    // Database
    switch (config.database) {
      case "supabase":
        deps["@supabase/supabase-js"] = "^2.47.0";
        deps["@supabase/ssr"] = "^0.5.0";
        break;
      case "convex":
        deps["convex"] = "^1.17.0";
        break;
      case "neon":
        deps["@neondatabase/serverless"] = "^0.10.0";
        deps["drizzle-orm"] = "^0.38.0";
        break;
      case "planetscale":
        deps["@planetscale/database"] = "^1.19.0";
        deps["drizzle-orm"] = "^0.38.0";
        break;
      case "turso":
        deps["@libsql/client"] = "^0.14.0";
        deps["drizzle-orm"] = "^0.38.0";
        break;
      case "sqlite":
        deps["better-sqlite3"] = "^11.7.0";
        deps["drizzle-orm"] = "^0.38.0";
        break;
    }

    // Auth
    switch (config.auth) {
      case "next-auth":
        deps["next-auth"] = "^5.0.0-beta.25";
        break;
      case "clerk":
        deps["@clerk/nextjs"] = "^6.9.0";
        break;
      case "better-auth":
        deps["better-auth"] = "^1.1.0";
        break;
    }

    return deps;
  }

  protected getDevDependencies(config: ProjectConfig): Record<string, string> {
    const devDeps: Record<string, string> = {};

    if (config.extras.typescript) {
      devDeps["typescript"] = "^5.7.0";
      devDeps["@types/node"] = "^22.10.0";
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
      devDeps["eslint-config-next"] = "^15.1.0";
      devDeps["prettier"] = "^3.4.0";
    }

    if (config.extras.testing) {
      devDeps["vitest"] = "^2.1.0";
      devDeps["@vitejs/plugin-react"] = "^4.3.0";
      devDeps["@testing-library/react"] = "^16.1.0";
    }

    if (config.database === "sqlite") {
      devDeps["@types/better-sqlite3"] = "^7.6.0";
    }

    if (
      config.database === "neon" ||
      config.database === "planetscale" ||
      config.database === "turso" ||
      config.database === "sqlite"
    ) {
      devDeps["drizzle-kit"] = "^0.30.0";
    }

    return devDeps;
  }

  protected getTailwindContentPaths(): string[] {
    return [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ];
  }

  private getNextTSConfig(): object {
    return {
      compilerOptions: {
        target: "ES2017",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: {
          "@/*": ["./*"],
        },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    };
  }

  private getNextConfig(config: ProjectConfig): string {
    let content = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
`;

    if (config.extras.docker) {
      content += `  output: "standalone",
`;
    }

    content += `};

export default nextConfig;
`;
    return content;
  }

  private getNextESLintConfig(): object {
    return {
      extends: ["next/core-web-vitals", "next/typescript"],
    };
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

  private getLayoutFile(config: ProjectConfig, ext: string, cssExt: string): string {
    const imports: string[] = [];
    let providerStart = "";
    let providerEnd = "";

    if (config.auth === "clerk") {
      imports.push(`import { ClerkProvider } from "@clerk/nextjs";`);
      providerStart = "<ClerkProvider>";
      providerEnd = "</ClerkProvider>";
    }

    if (config.database === "convex") {
      imports.push(`import { ConvexClientProvider } from "@/components/providers/convex-provider";`);
      if (providerStart) {
        providerStart += "\n        <ConvexClientProvider>";
        providerEnd = "</ConvexClientProvider>\n        " + providerEnd;
      } else {
        providerStart = "<ConvexClientProvider>";
        providerEnd = "</ConvexClientProvider>";
      }
    }

    const typeAnnotation = config.extras.typescript
      ? `

export const metadata: Metadata = {
  title: "${config.projectName}",
  description: "Created with create-mrn-app",
};
`
      : "";

    const metadataImport = config.extras.typescript ? `import type { Metadata } from "next";` : "";

    return `${metadataImport}
${imports.join("\n")}
import "./globals.css";
${typeAnnotation}
export default function RootLayout({
  children,
}: ${config.extras.typescript ? "Readonly<{ children: React.ReactNode }>" : "{ children }"}) {
  return (
    <html lang="en">
      <body>
        ${providerStart ? providerStart + "\n          " : ""}{children}${providerEnd ? "\n          " + providerEnd : ""}
      </body>
    </html>
  );
}
`;
  }

  private getPageFile(config: ProjectConfig): string {
    const hasTailwind = config.styling === "tailwind" || config.styling === "tailwind-shadcn";

    return `export default function Home() {
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
`;
  }

  private getGlobalCSS(config: ProjectConfig): string {
    if (config.styling === "tailwind" || config.styling === "tailwind-shadcn") {
      return this.getTailwindCSS();
    }

    return `* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}
`;
  }

  private getVitestConfig(): string {
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
      "@": path.resolve(__dirname, "./"),
    },
  },
});
`;
  }

  // Database helpers
  private getSupabaseClient(config: ProjectConfig): string {
    return `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`;
  }

  private getSupabaseServer(config: ProjectConfig): string {
    return `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handle server component limitation
          }
        },
      },
    }
  );
}
`;
  }

  private getConvexSchema(): string {
    return `import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Define your tables here
  // Example:
  // tasks: defineTable({
  //   text: v.string(),
  //   completed: v.boolean(),
  // }),
});
`;
  }

  private getDrizzleClient(config: ProjectConfig): string {
    switch (config.database) {
      case "neon":
        return `import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
`;
      case "turso":
        return `import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
`;
      case "planetscale":
        return `import { Client } from "@planetscale/database";
import { drizzle } from "drizzle-orm/planetscale-serverless";
import * as schema from "./schema";

const client = new Client({
  url: process.env.DATABASE_URL!,
});

export const db = drizzle(client, { schema });
`;
      default:
        return `import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database("sqlite.db");
export const db = drizzle(sqlite, { schema });
`;
    }
  }

  private getDrizzleSchema(): string {
    return `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Example table - customize as needed
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
`;
  }

  // Auth helpers
  private getNextAuthConfig(config: ProjectConfig): string {
    return `import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
});
`;
  }

  private getNextAuthRoute(): string {
    return `import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
`;
  }

  private getClerkMiddleware(): string {
    return `import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
`;
  }

  private getBetterAuthConfig(config: ProjectConfig): string {
    return `import { betterAuth } from "better-auth";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  // Add your database adapter here
  // database: yourDatabaseAdapter,
  emailAndPassword: {
    enabled: true,
  },
});
`;
  }

  private getBetterAuthRoute(): string {
    return `import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
`;
  }
}
