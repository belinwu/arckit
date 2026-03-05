const MULTI_INSTANCE_TYPES = new Set([
  "ADR", "DIAG", "DFD", "WARD", "DMC", "RSCH", "AWRS", "AZRS", "GCRS", "DSCT",
]);

export function generateDocId(
  projectId: string,
  docType: string,
  sequenceNum?: number,
  version = "1.0"
): string {
  const parts = ["ARC", projectId, docType];
  if (MULTI_INSTANCE_TYPES.has(docType) && sequenceNum !== undefined) {
    parts.push(String(sequenceNum).padStart(3, "0"));
  }
  return `${parts.join("-")}-v${version}`;
}

export function generateFilename(
  projectId: string,
  docType: string,
  sequenceNum?: number,
  version = "1.0"
): string {
  return `${generateDocId(projectId, docType, sequenceNum, version)}.md`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
