export function killProcessGroup(child, signal) {
  if (!child || typeof child.pid !== "number") return false;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
    return true;
  } catch {
    return false;
  }
}
