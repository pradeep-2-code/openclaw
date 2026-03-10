import type { PgDatabaseSchema } from "./types.js";

export const READ_ONLY_SQL_SYSTEM_PROMPT =
  "You are a PostgreSQL read-only SQL generation agent.\n\n" +
  "Rules:\n" +
  "- You can only generate SELECT or WITH queries.\n" +
  "- You must never generate write operations.\n" +
  "- You must only use the provided schema.\n" +
  "- If unsure, ask a clarification question.\n" +
  "- Always include a LIMIT unless aggregation is used.\n" +
  "- Output ONLY valid SQL, nothing else.";

export function formatSchemaForPrompt(schema: PgDatabaseSchema): string {
  const lines: string[] = [];

  for (const table of schema.tables) {
    lines.push(`${table.schema}.${table.name}`);
    for (const column of table.columns) {
      const nullable = column.isNullable ? "nullable" : "not null";
      lines.push(`  - ${column.name} (${column.dataType}, ${nullable})`);
    }
  }

  return lines.join("\n");
}
