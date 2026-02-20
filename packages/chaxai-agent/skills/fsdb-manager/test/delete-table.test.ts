#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";

const TEST_DB_PATH = path.resolve(
  __dirname,
  "..",
  "references",
  "examples",
  "delete-table"
);

interface SetupTableOptions {
  type: "struct" | "extend" | "resource";
  name: string;
  schema?: Record<string, unknown>;
  extendsDef?: Array<{ field: string; struct: string; desc?: string }>;
  description?: string;
}

function setupTable(options: SetupTableOptions): void {
  const tablePrefix: Record<string, string> = {
    struct: "[struct]",
    extend: "[extend]",
    resource: "[resource]",
  };

  const tableDirName = `${tablePrefix[options.type]}${options.name}`;
  const tablePath = path.join(TEST_DB_PATH, tableDirName);

  if (!fs.existsSync(tablePath)) {
    fs.mkdirSync(tablePath, { recursive: true });
  }

  const metaFiles: Record<string, string[]> = {
    struct: [".info.meta"],
    extend: [".info.meta", ".extend.meta"],
    resource: [".desc.meta"],
  };

  for (const metaFile of metaFiles[options.type]) {
    const metaPath = path.join(tablePath, metaFile);
    let content = "";

    switch (metaFile) {
      case ".info.meta":
        const infoMeta = {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          title: options.schema?.title || options.name,
          description: options.schema?.description || "",
          properties: options.schema?.properties || {},
          required: options.schema?.required || [],
          ...options.schema,
        };
        content = JSON.stringify(infoMeta, null, 2);
        break;

      case ".extend.meta":
        const extendLines = (options.extendsDef || []).map((ext) =>
          JSON.stringify({
            field: ext.field,
            struct: ext.struct,
            desc: ext.desc || "",
          })
        );
        content = extendLines.join("\n");
        break;

      case ".desc.meta":
        content = options.description || `# ${options.name}\n\nResource table description.`;
        break;
    }

    fs.writeFileSync(metaPath, content, "utf-8");
  }

  const dataFiles = ["data001.json", "data002.json"];
  for (const dataFile of dataFiles) {
    fs.writeFileSync(
      path.join(tablePath, dataFile),
      JSON.stringify({ key: dataFile.replace(".json", ""), value: "test data" }),
      "utf-8"
    );
  }
}

function tableExists(tableName: string): boolean {
  const prefixes = ["[struct]", "[extend]", "[resource]"];
  for (const prefix of prefixes) {
    const tablePath = path.join(TEST_DB_PATH, `${prefix}${tableName}`);
    if (fs.existsSync(tablePath)) {
      return true;
    }
  }
  return false;
}

async function deleteTable(tableName: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
  const prefixes = ["[struct]", "[extend]", "[resource]"];
  let tablePath: string | null = null;

  for (const prefix of prefixes) {
    const candidatePath = path.join(TEST_DB_PATH, `${prefix}${tableName}`);
    if (fs.existsSync(candidatePath)) {
      tablePath = candidatePath;
      break;
    }
  }

  if (!tablePath) {
    return { success: false, error: "Table not found" };
  }

  try {
    fs.rmSync(tablePath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

describe("FSDB Table Deletion", () => {
  beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { recursive: true, force: true });
    }

    fs.mkdirSync(TEST_DB_PATH, { recursive: true });

    setupTable({ type: "struct", name: "users", schema: { title: "Users", properties: { id: { type: "string" } }, required: ["id"] } });
    setupTable({ type: "struct", name: "products", schema: { title: "Products", properties: { product_id: { type: "string" } }, required: ["product_id"] } });
    setupTable({ type: "extend", name: "orders", schema: { title: "Orders", properties: { order_id: { type: "string" } }, required: ["order_id"] }, extendsDef: [{ field: "user_id", struct: "users" }] });
    setupTable({ type: "resource", name: "avatars", description: "# Avatars\n\nUser avatar images." });
  });

  it("should verify test tables are created", () => {
    expect(tableExists("users")).toBe(true);
    expect(tableExists("products")).toBe(true);
    expect(tableExists("orders")).toBe(true);
    expect(tableExists("avatars")).toBe(true);

    const usersPath = path.join(TEST_DB_PATH, "[struct]users");
    expect(fs.existsSync(path.join(usersPath, ".info.meta"))).toBe(true);
    expect(fs.existsSync(path.join(usersPath, "data001.json"))).toBe(true);
    expect(fs.existsSync(path.join(usersPath, "data002.json"))).toBe(true);
  });

  it("should delete a struct table successfully", async () => {
    const result = await deleteTable("products", true);
    expect(result.success).toBe(true);
    expect(tableExists("products")).toBe(false);
  });

  it("should delete an extend table successfully", async () => {
    const ordersPath = path.join(TEST_DB_PATH, "[extend]orders");
    expect(fs.existsSync(ordersPath)).toBe(true);

    const result = await deleteTable("orders", true);
    expect(result.success).toBe(true);
    expect(tableExists("orders")).toBe(false);
  });

  it("should delete a resource table successfully", async () => {
    const result = await deleteTable("avatars", true);
    expect(result.success).toBe(true);
    expect(tableExists("avatars")).toBe(false);
  });

  it("should return error when table not found", async () => {
    const result = await deleteTable("nonexistent", true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Table not found");
  });

  it("should preserve other tables when deleting one", () => {
    expect(tableExists("users")).toBe(true);
  });

  it("should delete table with all its contents", async () => {
    setupTable({ type: "struct", name: "totest", schema: { title: "Test", properties: { id: { type: "string" } }, required: ["id"] } });

    const testPath = path.join(TEST_DB_PATH, "[struct]totest");
    expect(fs.existsSync(testPath)).toBe(true);
    expect(fs.existsSync(path.join(testPath, ".info.meta"))).toBe(true);
    expect(fs.existsSync(path.join(testPath, "data001.json"))).toBe(true);

    const result = await deleteTable("totest", true);
    expect(result.success).toBe(true);
    expect(fs.existsSync(testPath)).toBe(false);
  });

  it("should handle multiple table types correctly", async () => {
    setupTable({ type: "struct", name: "categories", schema: { title: "Categories", properties: { cat_id: { type: "string" } }, required: ["cat_id"] } });
    setupTable({ type: "extend", name: "order_items", schema: { title: "Order Items", properties: { item_id: { type: "string" } }, required: ["item_id"] }, extendsDef: [{ field: "order_id", struct: "orders" }] });

    expect(tableExists("categories")).toBe(true);
    expect(tableExists("order_items")).toBe(true);

    const result1 = await deleteTable("categories", true);
    expect(result1.success).toBe(true);
    expect(tableExists("categories")).toBe(false);

    const result2 = await deleteTable("order_items", true);
    expect(result2.success).toBe(true);
    expect(tableExists("order_items")).toBe(false);
  });
});

console.log("\n🧪 FSDB Table Deletion Tests");
console.log("============================\n");
console.log("Test database path:", TEST_DB_PATH);
console.log("Run with: bun test test/delete-table.test.ts\n");
