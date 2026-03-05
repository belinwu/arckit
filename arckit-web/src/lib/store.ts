"use client";

const PROJECTS_KEY = "arckit-projects";
const ARTIFACTS_KEY = "arckit-artifacts";

export interface Project {
  projectId: string;
  slug: string;
  displayName: string;
  createdAt: string;
}

export interface Artifact {
  projectId: string;
  documentId: string;
  documentType: string;
  title: string;
  content: string;
  status: string;
  version: string;
  createdAt: string;
}

function getItem<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function setItem<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Projects
export function getProjects(): Project[] {
  return getItem<Project>(PROJECTS_KEY);
}

export function getProject(projectId: string): Project | undefined {
  return getProjects().find((p) => p.projectId === projectId);
}

export function createProject(displayName: string): Project {
  const projects = getProjects();
  const maxId = projects.reduce(
    (max, p) => Math.max(max, parseInt(p.projectId, 10)),
    0
  );
  const projectId = String(maxId + 1).padStart(3, "0");
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const project: Project = {
    projectId,
    slug,
    displayName,
    createdAt: new Date().toISOString(),
  };
  setItem(PROJECTS_KEY, [...projects, project]);
  return project;
}

// Artifacts
export function getArtifacts(projectId?: string): Artifact[] {
  const all = getItem<Artifact>(ARTIFACTS_KEY);
  return projectId ? all.filter((a) => a.projectId === projectId) : all;
}

export function getArtifact(documentId: string): Artifact | undefined {
  return getItem<Artifact>(ARTIFACTS_KEY).find(
    (a) => a.documentId === documentId
  );
}

export function saveArtifact(artifact: Artifact): void {
  const all = getItem<Artifact>(ARTIFACTS_KEY);
  const existing = all.findIndex(
    (a) => a.documentId === artifact.documentId
  );
  if (existing >= 0) {
    all[existing] = artifact;
  } else {
    all.push(artifact);
  }
  setItem(ARTIFACTS_KEY, all);
}
