#!/usr/bin/env node
/**
 * ArcKit PostToolUse (Write) Hook — Document Quality Gate
 *
 * Advisory hook that validates ARC document content quality after writes.
 * Never blocks writes — surfaces warnings as additionalContext so Claude
 * can offer to fix issues.
 *
 * Checks:
 *   1. Document control completeness (detects placeholder text)
 *   2. Requirement ID format validation
 *   3. Empty section detection (headings with no content)
 *   4. Cross-reference integrity (referenced ARC docs exist)
 *
 * Hook Type: PostToolUse
 * Matcher: Write
 * Input (stdin):  JSON { tool_name, tool_input: { file_path, content }, tool_output }
 * Output (stdout): JSON with additionalContext warnings (or empty for pass-through)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isDir, isFile, extractDocType } from './hook-utils.mjs';
import { DOC_TYPES } from '../config/doc-types.mjs';

// --- Read stdin ---
let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}
if (!raw || !raw.trim()) process.exit(0);

let data;
try {
  data = JSON.parse(raw);
} catch {
  process.exit(0);
}

// --- Early exit: only process ARC-*.md files ---
const filePath = (data.tool_input || {}).file_path || '';
const filename = basename(filePath);
if (!filename.startsWith('ARC-') || !filename.endsWith('.md')) process.exit(0);
if (!filePath.includes('/projects/')) process.exit(0);

const content = (data.tool_input || {}).content || '';
if (!content) process.exit(0);

const docType = extractDocType(filename);
if (!docType) process.exit(0);

const warnings = [];

// --- Check 1: Document Control Completeness ---
const PLACEHOLDER_PATTERNS = [
  /\[Project Name\]/i,
  /\[Author\]/i,
  /\[Owner\]/i,
  /\[Your Name\]/i,
  /\[Organisation\]/i,
  /\[Date\]/i,
  /\[Version\]/i,
  /\bTBD\b/,
  /\bTODO\b/i,
  /\bPLACEHOLDER\b/i,
  /\[INSERT\b/i,
  /\bXXX\b/,
  /\[FILL IN\]/i,
];

const DOC_CONTROL_RE = /^\|\s*\*\*([^*]+)\*\*\s*\|\s*(.+?)\s*\|/;
const lines = content.split('\n');
const placeholderFields = [];

for (const line of lines) {
  const m = line.match(DOC_CONTROL_RE);
  if (!m) continue;
  const fieldName = m[1].trim();
  const fieldValue = m[2].trim();

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(fieldValue)) {
      placeholderFields.push(fieldName + ': "' + fieldValue + '"');
      break;
    }
  }
}

if (placeholderFields.length > 0) {
  warnings.push('**Placeholder text detected** in document control:\n' + placeholderFields.map(f => '  - ' + f).join('\n'));
}

// --- Check 2: Requirement ID Validity ---
const MALFORMED_RE = /\b(BR|FR|NFR|INT|DR)-(\d{1,2})\b(?!\d)/g;

const malformedIds = [];
let match;
while ((match = MALFORMED_RE.exec(content)) !== null) {
  malformedIds.push(match[0]);
}

if (malformedIds.length > 0) {
  const unique = [...new Set(malformedIds)];
  warnings.push('**Malformed requirement IDs** (should be 3 digits, e.g. BR-001):\n' + unique.map(id => '  - ' + id).join('\n'));
}

// --- Check 3: Empty Section Detection ---
const emptySections = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!/^##\s+/.test(line)) continue;

  let hasContent = false;
  for (let j = i + 1; j < lines.length; j++) {
    const nextLine = lines[j].trim();
    if (/^#{1,3}\s+/.test(nextLine)) break;
    if (nextLine && !nextLine.startsWith('|') && nextLine !== '---') {
      hasContent = true;
      break;
    }
    if (nextLine.startsWith('|') && !nextLine.includes('---')) {
      hasContent = true;
      break;
    }
  }

  if (!hasContent) {
    const heading = line.replace(/^##\s+/, '').trim();
    if (!['Document Control', 'Revision History', 'Appendices', 'References'].includes(heading)) {
      emptySections.push(heading);
    }
  }
}

if (emptySections.length > 0) {
  warnings.push('**Empty sections** (heading with no content below):\n' + emptySections.map(s => '  - ## ' + s).join('\n'));
}

// --- Check 4: Cross-Reference Integrity ---
const ARC_REF_RE = /\bARC-(\d{3})-([A-Z][\w-]*?)(?:-v[\d.]+)?(?:\.md)?\b/g;
const referencedDocs = new Set();
while ((match = ARC_REF_RE.exec(content)) !== null) {
  const refId = match[0].replace(/\.md$/, '');
  if (!filename.includes(refId)) {
    referencedDocs.add(refId);
  }
}

if (referencedDocs.size > 0) {
  const afterProjects = filePath.split('projects/')[1];
  if (afterProjects) {
    const projectDirName = afterProjects.split('/')[0];
    const projectsBase = filePath.split('projects/')[0] + 'projects';
    const projectDir = join(projectsBase, projectDirName);

    const missingRefs = [];
    for (const ref of referencedDocs) {
      let found = false;
      const searchDirs = [projectDir];
      for (const subdir of ['decisions', 'diagrams', 'wardley-maps', 'data-contracts', 'reviews']) {
        const subPath = join(projectDir, subdir);
        if (isDir(subPath)) searchDirs.push(subPath);
      }

      for (const dir of searchDirs) {
        try {
          const files = readdirSync(dir);
          if (files.some(f => f.includes(ref))) {
            found = true;
            break;
          }
        } catch { /* ignore */ }
      }

      if (!found) missingRefs.push(ref);
    }

    if (missingRefs.length > 0) {
      warnings.push('**Cross-references to non-existent documents**:\n' + missingRefs.map(r => '  - ' + r).join('\n'));
    }
  }
}

// --- Output ---
if (warnings.length === 0) process.exit(0);

const typeInfo = DOC_TYPES[docType];
const typeName = typeInfo ? typeInfo.name : docType;

const messageParts = [
  '## Document Quality Gate — ' + warnings.length + ' warning(s)',
  '',
  '**File:** ' + filename + ' (' + typeName + ')',
  '',
];
for (let i = 0; i < warnings.length; i++) {
  messageParts.push('### ' + (i + 1) + '. ' + warnings[i]);
}
messageParts.push('');
messageParts.push('*These are advisory warnings — the file has been written successfully. Consider addressing the issues above.*');

const message = messageParts.join('\n');

const output = {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: message,
  },
};
console.log(JSON.stringify(output));
