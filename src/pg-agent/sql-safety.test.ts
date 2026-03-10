import { describe, expect, it } from "vitest";

import { validateReadOnlySql } from "./sql-safety.js";

describe("validateReadOnlySql", () => {
  it("allows SELECT and appends LIMIT when missing", () => {
    const result = validateReadOnlySql("SELECT id FROM users", {
      defaultLimit: 200,
    });

    expect(result.ok).toBe(true);
    expect(result.sql).toBe("SELECT id FROM users LIMIT 200");
    expect(result.limitAdded).toBe(true);
  });

  it("does not append LIMIT for aggregation", () => {
    const result = validateReadOnlySql("SELECT COUNT(*) FROM users", {
      defaultLimit: 50,
    });

    expect(result.ok).toBe(true);
    expect(result.sql).toBe("SELECT COUNT(*) FROM users");
    expect(result.limitAdded).toBe(false);
  });

  it("blocks write operations", () => {
    const result = validateReadOnlySql("UPDATE users SET name = 'x'", {
      defaultLimit: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Only SELECT, WITH, or EXPLAIN/i);
  });

  it("blocks multiple statements", () => {
    const result = validateReadOnlySql("SELECT 1; SELECT 2;", {
      defaultLimit: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Multiple SQL statements/i);
  });
});
