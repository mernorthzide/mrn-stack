import pc from "picocolors";

export const logger = {
  info: (message: string) => {
    console.log(pc.blue("info") + " - " + message);
  },

  success: (message: string) => {
    console.log(pc.green("success") + " - " + message);
  },

  warn: (message: string) => {
    console.log(pc.yellow("warn") + " - " + message);
  },

  error: (message: string) => {
    console.log(pc.red("error") + " - " + message);
  },

  step: (step: number, total: number, message: string) => {
    console.log(pc.dim(`[${step}/${total}]`) + " " + message);
  },

  title: (message: string) => {
    console.log("\n" + pc.bold(pc.cyan(message)) + "\n");
  },

  dim: (message: string) => {
    console.log(pc.dim(message));
  },

  break: () => {
    console.log("");
  },
};

export const banner = () => {
  console.log("");
  console.log(pc.bold(pc.cyan("  create-mrn-app ")));
  console.log(pc.dim("  Scaffold modern full-stack apps"));
  console.log("");
};
