import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import type { Client } from "pg";

import type { ExportFormat, QueryMetadata } from "./types.js";

const require = createRequire(import.meta.url);
const { copyTo } = require("pg-copy-streams");

export interface ExportOptions {
  baseDir: string;
  format: ExportFormat;
  queryName?: string;
}

export async function exportQueryResults(
  client: Client,
  sql: string,
  options: ExportOptions,
): Promise<QueryMetadata> {
  if (options.format === "parquet") {
    throw new Error("Parquet export is not configured for this deployment.");
  }

  const { filePath } = await exportCsv(client, sql, options);
  const columns = await fetchColumns(client, sql);
  const rowCount = await fetchRowCount(client, sql);

  return { filePath, rowCount, columns };
}

async function exportCsv(
  client: Client,
  sql: string,
  options: ExportOptions,
): Promise<{ filePath: string }> {
  await mkdir(options.baseDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = (options.queryName ?? "query").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filePath = path.join(options.baseDir, `${timestamp}_${safeName}.csv`);

  const copyStream = client.query(copyTo(`COPY (${sql}) TO STDOUT WITH CSV HEADER`));
  const fileStream = createWriteStream(filePath, { encoding: "utf-8" });
  await pipeline(copyStream, fileStream);

  return { filePath };
}

async function fetchColumns(
  client: Client,
  sql: string,
): Promise<Array<{ name: string; dataType: string }>> {
  const wrapped = `SELECT * FROM (${sql}) AS openclaw_query LIMIT 0`;
  const result = await client.query(wrapped);

  return result.fields.map((field) => ({
    name: field.name,
    dataType: field.dataTypeID.toString(),
  }));
}

async function fetchRowCount(client: Client, sql: string): Promise<number> {
  const wrapped = `SELECT COUNT(*)::bigint AS row_count FROM (${sql}) AS openclaw_query`;
  const result = await client.query<{ row_count: string }>(wrapped);
  const row = result.rows[0];
  return row ? Number(row.row_count) : 0;
}
