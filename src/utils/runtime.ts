import { execa } from "execa";

export async function checkBunInstalled(): Promise<boolean> {
  try {
    await execa("bun", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export async function getBunVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa("bun", ["--version"], { stdio: "pipe" });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function checkNodeVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa("node", ["--version"], { stdio: "pipe" });
    return stdout.trim();
  } catch {
    return null;
  }
}
