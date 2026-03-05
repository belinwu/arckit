import fs from "fs";
import path from "path";

/**
 * Resolve the path to arckit-plugin/templates/ relative to the repo root.
 *
 * The arckit-web app lives at <repo-root>/arckit-web/, so from the app's
 * working directory we go up one level to reach the repo root, then into
 * arckit-plugin/templates/.
 *
 * We try process.cwd() first (reliable in both Next.js and vitest), then
 * fall back to __dirname-based resolution.
 */
function getTemplatesDir(): string {
  // Try cwd-based resolution: cwd is typically <repo-root>/arckit-web/
  const cwdBased = path.resolve(process.cwd(), "..", "arckit-plugin", "templates");
  if (fs.existsSync(cwdBased)) {
    return cwdBased;
  }

  // Fallback: __dirname-based resolution (src/lib/ -> ../../.. -> repo root)
  const dirnameBased = path.resolve(__dirname, "..", "..", "..", "arckit-plugin", "templates");
  if (fs.existsSync(dirnameBased)) {
    return dirnameBased;
  }

  throw new Error(
    `Cannot find arckit-plugin/templates/ directory. Tried:\n  ${cwdBased}\n  ${dirnameBased}`
  );
}

export function listTemplates(): string[] {
  const dir = getTemplatesDir();
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("-template.md"))
    .map((f) => f.replace("-template.md", ""));
}

export function loadTemplate(name: string): string | undefined {
  const dir = getTemplatesDir();
  const filePath = path.join(dir, `${name}-template.md`);
  if (!fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, "utf-8");
}
