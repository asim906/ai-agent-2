import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const authDir = path.join(os.tmpdir(), "wa-auth");
console.log("Cleaning:", authDir);

try {
  fs.rmSync(authDir, { recursive: true, force: true });
  console.log("Cleaned successfully");
} catch (err) {
  console.error("Error cleaning:", err);
}
