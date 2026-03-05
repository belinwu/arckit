import { cpSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const repoRoot = resolve(root, "..");

const commandsSrc = resolve(repoRoot, "arckit-plugin/commands");
const templatesSrc = resolve(repoRoot, "arckit-plugin/templates");

if (!existsSync(commandsSrc)) {
  console.warn(`Warning: ${commandsSrc} not found. Skipping command bundling.`);
} else {
  mkdirSync(resolve(root, "data/commands"), { recursive: true });
  cpSync(commandsSrc, resolve(root, "data/commands"), { recursive: true });
  console.log("Bundled commands into data/commands/");
}

if (!existsSync(templatesSrc)) {
  console.warn(`Warning: ${templatesSrc} not found. Skipping template bundling.`);
} else {
  mkdirSync(resolve(root, "data/templates"), { recursive: true });
  cpSync(templatesSrc, resolve(root, "data/templates"), { recursive: true });
  console.log("Bundled templates into data/templates/");
}
