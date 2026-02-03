import type { SqlSafetyConfig, SqlSafetyResult } from "./types.js";

const ALLOWED_START = /^(select|with|explain)\b/i;
const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "grant",
  "revoke",
  "vacuum",
  "analyze",
  "copy",
  "set",
];
const AGGREGATE_FUNCTIONS = /\b(count|sum|avg|min|max|bool_and|bool_or|string_agg|array_agg)\s*\(/i;
const GROUP_BY = /\bgroup\s+by\b/i;

export function validateReadOnlySql(sql: string, config: SqlSafetyConfig): SqlSafetyResult {
  const cleaned = stripSqlLiteralsAndComments(sql);
  const trimmed = cleaned.trim();

  if (!ALLOWED_START.test(trimmed)) {
    return { ok: false, error: "Only SELECT, WITH, or EXPLAIN statements are allowed." };
  }

  const forbidden = findForbiddenKeyword(trimmed);
  if (forbidden) {
    return { ok: false, error: `Forbidden SQL keyword detected: ${forbidden}.` };
  }

  if (hasMultipleStatements(trimmed)) {
    return { ok: false, error: "Multiple SQL statements are not allowed." };
  }

  const { sql: limitedSql, limitAdded } = enforceLimit(sql, trimmed, config);
  return { ok: true, sql: limitedSql, limitAdded };
}

function hasMultipleStatements(cleaned: string): boolean {
  const withoutTrailing = cleaned.replace(/;\s*$/, "").trim();
  return /;/.test(withoutTrailing);
}

function findForbiddenKeyword(cleaned: string): string | null {
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(cleaned)) return keyword;
  }
  return null;
}

function enforceLimit(
  originalSql: string,
  cleanedSql: string,
  config: SqlSafetyConfig,
): { sql: string; limitAdded: boolean } {
  const hasLimit = /\blimit\b/i.test(cleanedSql);
  const hasAggregation = AGGREGATE_FUNCTIONS.test(cleanedSql) || GROUP_BY.test(cleanedSql);

  if (hasLimit || hasAggregation) {
    return { sql: originalSql.trim(), limitAdded: false };
  }

  const sanitized = originalSql.replace(/;\s*$/, "").trim();
  const limitedSql = `${sanitized} LIMIT ${config.defaultLimit}`;
  return { sql: limitedSql, limitAdded: true };
}

function stripSqlLiteralsAndComments(sql: string): string {
  let output = "";
  let i = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sql.length) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += " ";
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 2;
        output += " ";
        continue;
      }
      i += 1;
      continue;
    }

    if (!inDoubleQuote && char === "'" && !inSingleQuote) {
      inSingleQuote = true;
      output += " ";
      i += 1;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'" && next === "'") {
        i += 2;
        continue;
      }
      if (char === "'") {
        inSingleQuote = false;
      }
      i += 1;
      continue;
    }

    if (!inSingleQuote && char === '"' && !inDoubleQuote) {
      inDoubleQuote = true;
      output += " ";
      i += 1;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      i += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 2;
      continue;
    }

    output += char;
    i += 1;
  }

  return output;
}
