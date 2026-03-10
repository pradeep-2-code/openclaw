import type { Client } from "pg";

import type { PgDatabaseSchema, PgSchemaLoadOptions, PgTableSchema } from "./types.js";

const DEFAULT_EXCLUDE_SCHEMAS = ["pg_catalog", "information_schema"];

export async function loadDatabaseSchema(
  client: Client,
  options: PgSchemaLoadOptions = {},
): Promise<PgDatabaseSchema> {
  const excludeSchemas = new Set([...DEFAULT_EXCLUDE_SCHEMAS, ...(options.excludeSchemas ?? [])]);
  const includeSchemas = options.includeSchemas;

  const params: string[] = [];
  const schemaConditions: string[] = [];

  if (includeSchemas && includeSchemas.length > 0) {
    params.push(includeSchemas);
    schemaConditions.push(`table_schema = ANY($${params.length})`);
  }

  if (excludeSchemas.size > 0) {
    params.push([...excludeSchemas]);
    schemaConditions.push(`table_schema <> ALL($${params.length})`);
  }

  const whereClause = schemaConditions.length > 0 ? `WHERE ${schemaConditions.join(" AND ")}` : "";

  const result = await client.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    ordinal_position: number;
  }>(
    `
    SELECT
      table_schema,
      table_name,
      column_name,
      data_type,
      is_nullable,
      ordinal_position
    FROM information_schema.columns
    ${whereClause}
    ORDER BY table_schema, table_name, ordinal_position
    `,
    params,
  );

  const tables = new Map<string, PgTableSchema>();

  for (const row of result.rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    const table = tables.get(key) ?? {
      schema: row.table_schema,
      name: row.table_name,
      columns: [],
    };

    table.columns.push({
      schema: row.table_schema,
      table: row.table_name,
      name: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === "YES",
      ordinalPosition: row.ordinal_position,
    });

    tables.set(key, table);
  }

  return { tables: [...tables.values()] };
}
