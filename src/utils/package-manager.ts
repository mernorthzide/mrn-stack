import { execa } from "execa";
import type { PackageManager } from "../types/config.js";

export async function installDependencies(
  cwd: string,
  pm: PackageManager
): Promise<void> {
  const command = getInstallCommand(pm);
  await execa(command.cmd, command.args, { cwd, stdio: "pipe" });
}

export async function addDependencies(
  cwd: string,
  pm: PackageManager,
  packages: string[],
  isDev = false
): Promise<void> {
  const command = getAddCommand(pm, packages, isDev);
  await execa(command.cmd, command.args, { cwd, stdio: "pipe" });
}

function getInstallCommand(pm: PackageManager): { cmd: string; args: string[] } {
  switch (pm) {
    case "npm":
      return { cmd: "npm", args: ["install"] };
    case "pnpm":
      return { cmd: "pnpm", args: ["install"] };
    case "bun":
      return { cmd: "bun", args: ["install"] };
  }
}

function getAddCommand(
  pm: PackageManager,
  packages: string[],
  isDev: boolean
): { cmd: string; args: string[] } {
  switch (pm) {
    case "npm":
      return {
        cmd: "npm",
        args: ["install", ...(isDev ? ["--save-dev"] : []), ...packages],
      };
    case "pnpm":
      return {
        cmd: "pnpm",
        args: ["add", ...(isDev ? ["-D"] : []), ...packages],
      };
    case "bun":
      return {
        cmd: "bun",
        args: ["add", ...(isDev ? ["-d"] : []), ...packages],
      };
  }
}

export function getRunCommand(pm: PackageManager, script: string): string {
  switch (pm) {
    case "npm":
      return `npm run ${script}`;
    case "pnpm":
      return `pnpm ${script}`;
    case "bun":
      return `bun run ${script}`;
  }
}

export function getExecCommand(pm: PackageManager): string {
  switch (pm) {
    case "npm":
      return "npx";
    case "pnpm":
      return "pnpm dlx";
    case "bun":
      return "bunx";
  }
}
