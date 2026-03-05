import fs from "fs";
import path from "path";

/**
 * Resolve the path to the templates directory.
 *
 * Resolution order:
 * 1. Bundled data (data/templates/) — for Vercel deployments
 * 2. cwd-based (../arckit-plugin/templates/) — for local dev
 * 3. __dirname-based fallback
 */
function getTemplatesDir(): string {
  // Check bundled data first (for Vercel)
  const bundled = path.resolve(process.cwd(), "data", "templates");
  if (fs.existsSync(bundled)) {
    return bundled;
  }

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
    `Cannot find templates directory. Tried:\n  ${bundled}\n  ${cwdBased}\n  ${dirnameBased}`
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
