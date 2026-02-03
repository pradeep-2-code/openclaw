import { Client } from "pg";

import { loadDatabaseSchema } from "./schema-loader.js";
import { exportQueryResults } from "./exporter.js";
import { READ_ONLY_SQL_SYSTEM_PROMPT } from "./prompt.js";
import { validateReadOnlySql } from "./sql-safety.js";
import type { PgQueryAgentOptions, QueryMetadata, SqlGenerator } from "./types.js";

const DEFAULT_EXPORT_DIR = "/exports";
const DEFAULT_LIMIT = 500;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

export class PgAiQueryAgent {
  private readonly options: PgQueryAgentOptions;
  private readonly sqlGenerator: SqlGenerator;

  constructor(options: PgQueryAgentOptions, sqlGenerator: SqlGenerator) {
    this.options = options;
    this.sqlGenerator = sqlGenerator;
  }

  async handleRequest(question: string): Promise<QueryMetadata> {
    const client = new Client(this.options.connection);
    await client.connect();

    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        `SET LOCAL statement_timeout = ${
          this.options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS
        }`,
      );

      const schema = await loadDatabaseSchema(client);
      const sql = await this.sqlGenerator.generateSql({
        question,
        schema,
        systemPrompt: READ_ONLY_SQL_SYSTEM_PROMPT,
      });

      const safetyResult = validateReadOnlySql(sql, {
        defaultLimit: this.options.defaultLimit ?? DEFAULT_LIMIT,
      });

      if (!safetyResult.ok || !safetyResult.sql) {
        throw new Error(safetyResult.error ?? "SQL validation failed.");
      }

      const metadata = await exportQueryResults(client, safetyResult.sql, {
        baseDir: this.options.exportBaseDir ?? DEFAULT_EXPORT_DIR,
        format: this.options.exportFormat ?? "csv",
        queryName: this.options.queryName,
      });

      await client.query("ROLLBACK");
      return metadata;
    } finally {
      await client.end();
    }
  }
}
