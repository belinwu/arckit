import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull().unique(),    // "001", "002"
  name: text("name").notNull(),                         // "payment-gateway"
  slug: text("slug").notNull(),                         // "payment-gateway"
  displayName: text("display_name").notNull(),          // "Payment Gateway"
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const artifacts = sqliteTable("artifacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),              // FK to projects.projectId
  documentId: text("document_id").notNull().unique(),   // "ARC-001-REQ-v1.0"
  documentType: text("document_type").notNull(),        // "REQ", "STKE", etc.
  sequenceNum: integer("sequence_num"),                 // For multi-instance (ADR-001)
  version: text("version").notNull().default("1.0"),
  title: text("title").notNull(),
  content: text("content").notNull(),                   // Full markdown content
  status: text("status").notNull().default("DRAFT"),
  classification: text("classification").notNull().default("PUBLIC"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyHash: text("key_hash").notNull(),                  // SHA-256 hash
  keyPrefix: text("key_prefix").notNull(),              // "sk-ant-...xxxx"
  createdAt: text("created_at").notNull(),
});
