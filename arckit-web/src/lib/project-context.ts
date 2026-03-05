export interface ProjectInfo {
  projectId: string;
  slug: string;
  displayName: string;
}

export interface ArtifactInfo {
  projectId: string;
  documentId: string;
  documentType: string;
}

export function buildProjectContext(
  projects: ProjectInfo[],
  artifacts: ArtifactInfo[],
  arcKitVersion: string
): string {
  let context = `## ArcKit Project Context (auto-generated)\n\n`;
  context += `ArcKit Version: ${arcKitVersion}\n\n`;
  context += `**${projects.length} project(s) found:**\n\n`;

  for (const project of projects) {
    const projectArtifacts = artifacts.filter(
      (a) => a.projectId === project.projectId
    );
    context += `### ${project.projectId}-${project.slug}\n`;
    context += `- **Project ID**: ${project.projectId}\n`;
    context += `- **Display Name**: ${project.displayName}\n`;
    context += `- **Artifacts** (${projectArtifacts.length}):\n`;

    for (const artifact of projectArtifacts) {
      context += `  - \`${artifact.documentId}.md\` (${artifact.documentType})\n`;
    }
    context += "\n";
  }

  return context;
}
