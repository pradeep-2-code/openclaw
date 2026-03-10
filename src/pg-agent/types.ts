import type { ClientConfig } from "pg";

export type ExportFormat = "csv" | "parquet";

export interface PgColumnSchema {
  schema: string;
  table: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
}

export interface PgTableSchema {
  schema: string;
  name: string;
  columns: PgColumnSchema[];
}

export interface PgDatabaseSchema {
  tables: PgTableSchema[];
}

export interface PgSchemaLoadOptions {
  includeSchemas?: string[];
  excludeSchemas?: string[];
}

export interface PgQueryAgentOptions {
  connection: ClientConfig;
  exportBaseDir?: string;
  exportFormat?: ExportFormat;
  defaultLimit?: number;
  statementTimeoutMs?: number;
  queryName?: string;
}

export interface SqlGenerationRequest {
  question: string;
  schema: PgDatabaseSchema;
  systemPrompt: string;
}

export interface SqlGenerator {
  generateSql(request: SqlGenerationRequest): Promise<string>;
}

export interface QueryMetadata {
  filePath: string;
  rowCount: number;
  columns: Array<{ name: string; dataType: string }>;
}

export interface SqlSafetyConfig {
  defaultLimit: number;
}

export interface SqlSafetyResult {
  ok: boolean;
  error?: string;
  sql?: string;
  limitAdded?: boolean;
}
