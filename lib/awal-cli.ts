import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runAwal(args: string[], options?: Parameters<typeof execFileAsync>[2]) {
  if (os.platform() === "win32") {
    const windowsArgs = ["/d", "/s", "/c", "npx", ...args];
    return execFileAsync("cmd.exe", windowsArgs, options);
  }

  return execFileAsync("npx", args, options);
}
