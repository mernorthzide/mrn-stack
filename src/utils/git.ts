import { execa } from "execa";

export async function initGit(cwd: string): Promise<void> {
  try {
    await execa("git", ["init"], { cwd, stdio: "pipe" });
    await execa("git", ["add", "-A"], { cwd, stdio: "pipe" });
    await execa(
      "git",
      ["commit", "-m", "Initial commit from create-mrn-app"],
      { cwd, stdio: "pipe" }
    );
  } catch {
    // Git init failed, but that's okay - user might not have git
  }
}

export async function isGitInstalled(): Promise<boolean> {
  try {
    await execa("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
