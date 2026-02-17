#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";

const TEST_DB_PATH = path.resolve(__dirname, "..", "references", "examples", "validate-schema");

interface TableSetup {
  type: "struct" | "extend" | "resource";
  name: string;
  schema?: Record<string, unknown>;
  extendsDef?: Array<{ field: string; struct: string; desc?: string }>;
  description?: string;
  invalidFiles?: Record<string, string>;
}

function setupTestTables(): void {
  fs.mkdirSync(TEST_DB_PATH, { recursive: true });

  const validTables: TableSetup[] = [
    {
      type: "struct",
      name: "users",
      schema: {
        title: "Users",
        properties: {
          id: { type: "string", description: "User ID" },
          name: { type: "string", description: "User name" },
          email: { type: "string", format: "email", description: "User email" },
        },
        required: ["id", "name", "email"],
      },
    },
    {
      type: "struct",
      name: "products",
      schema: {
        title: "Products",
        properties: {
          product_id: { type: "string", description: "Product ID" },
          name: { type: "string", description: "Product name" },
          price: { type: "number", description: "Product price" },
        },
        required: ["product_id", "name"],
      },
    },
    {
      type: "extend",
      name: "orders",
      schema: {
        title: "Orders",
        properties: {
          order_id: { type: "string", description: "Order ID" },
          user_id: { type: "string", description: "User ID" },
          product_id: { type: "string", description: "Product ID" },
        },
        required: ["order_id", "user_id", "product_id"],
      },
      extendsDef: [
        { field: "user_id", struct: "users", desc: "下单用户" },
        { field: "product_id", struct: "products", desc: "购买产品" },
      ],
    },
    {
      type: "resource",
      name: "avatars",
      description: "# 用户头像资源\n\n存储用户头像图片。",
    },
  ];

  for (const table of validTables) {
    const prefix = table.type === "struct" ? "[struct]" : table.type === "extend" ? "[extend]" : "[resource]";
    const tablePath = path.join(TEST_DB_PATH, `${prefix}${table.name}`);
    fs.mkdirSync(tablePath, { recursive: true });

    if (table.type === "struct" || table.type === "extend") {
      const infoMeta = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        title: table.schema?.title || table.name,
        description: table.schema?.description || "",
        properties: table.schema?.properties || {},
        required: table.schema?.required || [],
        ...table.schema,
      };
      fs.writeFileSync(path.join(tablePath, ".info.meta"), JSON.stringify(infoMeta, null, 2), "utf-8");
    }

    if (table.type === "extend") {
      const extendLines = (table.extendsDef || []).map((ext) =>
        JSON.stringify({ field: ext.field, struct: ext.struct, desc: ext.desc || "" })
      );
      fs.writeFileSync(path.join(tablePath, ".extend.meta"), extendLines.join("\n"), "utf-8");
    }

    if (table.type === "resource") {
      fs.writeFileSync(
        path.join(tablePath, ".desc.meta"),
        table.description || `# ${table.name}\n\nResource table description.`,
        "utf-8"
      );
    }

    if (table.type === "struct" || table.type === "extend") {
      fs.writeFileSync(
        path.join(tablePath, "data001.json"),
        JSON.stringify({ id: "001", value: "test" }),
        "utf-8"
      );
    }

    if (table.type === "resource") {
      fs.writeFileSync(path.join(tablePath, "avatar001.jpg"), "fake image data", "utf-8");
    }
  }

  const invalidTables: TableSetup[] = [
    {
      type: "struct",
      name: "invalid_struct",
      schema: {
        title: "Invalid Struct",
        properties: { id: { type: "string" } },
        required: [],
      },
    },
    {
      type: "extend",
      name: "invalid_extend_missing_ref",
      schema: {
        title: "Invalid Extend",
        properties: { order_id: { type: "string" }, user_id: { type: "string" } },
        required: ["order_id"],
      },
      extendsDef: [{ field: "nonexistent_field", struct: "users" }],
    },
    {
      type: "extend",
      name: "invalid_extend_bad_ref",
      schema: {
        title: "Invalid Extend",
        properties: { order_id: { type: "string" }, bad_ref_id: { type: "string" } },
        required: ["order_id"],
      },
      extendsDef: [{ field: "bad_ref_id", struct: "nonexistent_struct" }],
    },
    {
      type: "resource",
      name: "invalid_resource_missing_desc",
    },
  ];

  for (const table of invalidTables) {
    const prefix = table.type === "struct" ? "[struct]" : table.type === "extend" ? "[extend]" : "[resource]";
    const tablePath = path.join(TEST_DB_PATH, `${prefix}${table.name}`);
    fs.mkdirSync(tablePath, { recursive: true });

    if (table.type === "struct" || table.type === "extend") {
      const infoMeta = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        title: table.schema?.title || table.name,
        description: table.schema?.description || "",
        properties: table.schema?.properties || {},
        required: table.schema?.required || [],
        ...table.schema,
      };
      fs.writeFileSync(path.join(tablePath, ".info.meta"), JSON.stringify(infoMeta, null, 2), "utf-8");
    }

    if (table.type === "extend") {
      const extendLines = (table.extendsDef || []).map((ext) =>
        JSON.stringify({ field: ext.field, struct: ext.struct, desc: ext.desc || "" })
      );
      fs.writeFileSync(path.join(tablePath, ".extend.meta"), extendLines.join("\n"), "utf-8");
    }

    if (table.type === "resource" && table.name !== "invalid_resource_missing_desc") {
      fs.writeFileSync(path.join(tablePath, ".desc.meta"), table.description || "# Invalid\n", "utf-8");
    }
  }

  fs.mkdirSync(path.join(TEST_DB_PATH, "[struct]missing_meta"), { recursive: true });
  fs.writeFileSync(path.join(TEST_DB_PATH, "[struct]missing_meta", "data.json"), "{}", "utf-8");

  fs.mkdirSync(path.join(TEST_DB_PATH, "[extend]missing_info"), { recursive: true });
  fs.writeFileSync(path.join(TEST_DB_PATH, "[extend]missing_info", ".extend.meta"), '{"field":"test"}', "utf-8");

  fs.mkdirSync(path.join(TEST_DB_PATH, "[resource]missing_desc"), { recursive: true });
  fs.writeFileSync(path.join(TEST_DB_PATH, "[resource]missing_desc", "file.txt"), "content", "utf-8");

  const badDirPath = path.join(TEST_DB_PATH, "bad_dir_name");
  fs.mkdirSync(badDirPath, { recursive: true });
  fs.writeFileSync(path.join(badDirPath, ".info.meta"), JSON.stringify({ type: "object", properties: {} }), "utf-8");

  const invalidJsonPath = path.join(TEST_DB_PATH, "[struct]invalid_json");
  fs.mkdirSync(invalidJsonPath, { recursive: true });
  fs.writeFileSync(path.join(invalidJsonPath, ".info.meta"), "not valid json{{{", "utf-8");
}

function validateDirectoryName(tableDir: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!tableDir.startsWith("[") || !tableDir.endsWith("]")) {
    errors.push(`Directory name '${tableDir}' must start with '[' and end with ']'`);
  }

  const validPrefixes = ["[struct]", "[extend]", "[resource]"];
  const hasValidPrefix = validPrefixes.some((prefix) => tableDir.startsWith(prefix));

  if (!hasValidPrefix && tableDir.startsWith("[") && tableDir.endsWith("]")) {
    const prefix = tableDir.substring(0, tableDir.indexOf("]") + 1);
    errors.push(`Invalid prefix '${prefix}'. Must be one of: ${validPrefixes.join(", ")}`);
  }

  const name = tableDir.replace(/^\[struct\]|\[extend\]|\[resource\]/, "");
  if (name.length === 0) {
    errors.push("Table name cannot be empty");
  }

  if (/[<>:"/\\|?*]/.test(name)) {
    errors.push(`Table name '${name}' contains invalid characters`);
  }

  return { valid: errors.length === 0, errors };
}

function isValidJSON(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function validateInfoMeta(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push(".info.meta file is missing");
    return { valid: false, errors };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  if (!isValidJSON(content)) {
    errors.push(".info.meta is not valid JSON");
    return { valid: false, errors };
  }

  const schema = JSON.parse(content);
  const requiredFields = ["$schema", "type", "properties", "required"];
  for (const field of requiredFields) {
    if (!schema[field]) {
      errors.push(`.info.meta is missing required field: ${field}`);
    }
  }

  if (schema.$schema !== "http://json-schema.org/draft-07/schema#") {
    errors.push(`.info.meta has incorrect $schema version`);
  }

  if (schema.type !== "object") {
    errors.push(`.info.meta type must be 'object'`);
  }

  return { valid: errors.length === 0, errors };
}

function validateExtendMeta(filePath: string, structTables: Map<string, Record<string, unknown>>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push(".extend.meta file is missing");
    return { valid: false, errors };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (!isValidJSON(line)) {
      errors.push(`.extend.meta line ${i + 1} is not valid JSON`);
      continue;
    }

    const extDef = JSON.parse(line);
    if (!extDef.field || !extDef.struct) {
      errors.push(`.extend.meta line ${i + 1} is missing required fields (field, struct)`);
    }

    if (extDef.field && extDef.struct) {
      const structTable = structTables.get(extDef.struct);
      if (!structTable) {
        errors.push(`.extend.meta references non-existent struct table: ${extDef.struct}`);
      } else {
        const structProps = (structTable.properties as Record<string, unknown>) || {};
        if (!(structProps as Record<string, unknown>)[extDef.field]) {
          errors.push(`.extend.meta references field '${extDef.field}' which does not exist in struct '${extDef.struct}'`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateDescMeta(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(filePath)) {
    errors.push(".desc.meta file is missing");
    return { valid: false, errors };
  }

  return { valid: true, errors };
}

function validateTable(tableDir: string, dbPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tableInfo = parseTableName(tableDir);

  if (!tableInfo) {
    return { valid: false, errors: ["Invalid table directory name"] };
  }

  const nameResult = validateDirectoryName(tableDir);
  if (!nameResult.valid) {
    errors.push(...nameResult.errors);
  }

  const tablePath = path.join(dbPath, tableDir);
  if (!fs.existsSync(tablePath)) {
    return { valid: false, errors: ["Table directory does not exist"] };
  }

  const requiredFiles = getRequiredMetaFiles(tableInfo.type);
  for (const requiredFile of requiredFiles) {
    const filePath = path.join(tablePath, requiredFile);
    if (!fs.existsSync(filePath)) {
      errors.push(`Required file '${requiredFile}' is missing`);
    }
  }

  if ((tableInfo.type === "struct" || tableInfo.type === "extend") && errors.length === 0) {
    const infoResult = validateInfoMeta(path.join(tablePath, ".info.meta"));
    if (!infoResult.valid) {
      errors.push(...infoResult.errors);
    }
  }

  if (tableInfo.type === "extend" && errors.length === 0) {
    const structTables = getStructTables();
    const extendResult = validateExtendMeta(path.join(tablePath, ".extend.meta"), structTables);
    if (!extendResult.valid) {
      errors.push(...extendResult.errors);
    }
  }

  if (tableInfo.type === "resource" && errors.length === 0) {
    const descResult = validateDescMeta(path.join(tablePath, ".desc.meta"));
    if (!descResult.valid) {
      errors.push(...descResult.errors);
    }
  }

  return { valid: errors.length === 0, errors };
}

function parseTableName(tableDir: string): { name: string; type: "struct" | "extend" | "resource" } | null {
  if (tableDir.startsWith("[struct]")) {
    return { name: tableDir.slice(8), type: "struct" };
  } else if (tableDir.startsWith("[extend]")) {
    return { name: tableDir.slice(8), type: "extend" };
  } else if (tableDir.startsWith("[resource]")) {
    return { name: tableDir.slice(10), type: "resource" };
  }
  return null;
}

function getRequiredMetaFiles(type: string): string[] {
  return {
    struct: [".info.meta"],
    extend: [".info.meta", ".extend.meta"],
    resource: [".desc.meta"],
  }[type] || [];
}

function getAllTables(): string[] {
  if (!fs.existsSync(TEST_DB_PATH)) return [];
  return fs.readdirSync(TEST_DB_PATH).filter((item) => {
    const itemPath = path.join(TEST_DB_PATH, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

function getStructTables(): Map<string, Record<string, unknown>> {
  const structTables = new Map<string, Record<string, unknown>>();
  const tables = getAllTables();

  for (const tableDir of tables) {
    const tableInfo = parseTableName(tableDir);
    if (tableInfo?.type === "struct") {
      const infoPath = path.join(TEST_DB_PATH, tableDir, ".info.meta");
      if (fs.existsSync(infoPath)) {
        try {
          const content = fs.readFileSync(infoPath, "utf-8");
          if (isValidJSON(content)) {
            structTables.set(tableInfo.name, JSON.parse(content));
          }
        } catch {
          // Skip invalid files
        }
      }
    }
  }

  return structTables;
}

describe("FSDB Schema Validation", () => {
  console.log("Setting up test tables...");
  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { recursive: true, force: true });
    }
    console.log("Creating test tables in:", TEST_DB_PATH);
    setupTestTables();
    console.log("Test tables created.");
  });

  it("should validate valid struct table (users)", () => {
    const result = validateTable("[struct]users", TEST_DB_PATH);
    if (!result.valid) console.log("users errors:", result.errors);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate valid struct table (products)", () => {
    const result = validateTable("[struct]products", TEST_DB_PATH);
    if (!result.valid) console.log("products errors:", result.errors);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate valid extend table with valid references (orders)", () => {
    const structTables = getStructTables();
    const extendPath = path.join(TEST_DB_PATH, "[extend]orders", ".extend.meta");

    const result = validateExtendMeta(extendPath, structTables);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should validate valid resource table (avatars)", () => {
    const result = validateTable("[resource]avatars", TEST_DB_PATH);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail validation for struct table missing required fields (invalid_struct)", () => {
    const result = validateTable("[struct]invalid_struct", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes("required"))).toBe(true);
  });

  it("should fail validation for extend table referencing non-existent struct (invalid_extend_bad_ref)", () => {
    const result = validateTable("[extend]invalid_extend_bad_ref", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("non-existent struct"))).toBe(true);
  });

  it("should fail validation for extend table referencing field not in struct (invalid_extend_missing_ref)", () => {
    const structTables = getStructTables();
    const extendPath = path.join(TEST_DB_PATH, "[extend]invalid_extend_missing_ref", ".extend.meta");

    const result = validateExtendMeta(extendPath, structTables);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not exist in struct"))).toBe(true);
  });

  it("should fail validation for resource table missing .desc.meta (invalid_resource_missing_desc)", () => {
    const result = validateTable("[resource]invalid_resource_missing_desc", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(".desc.meta"))).toBe(true);
  });

  it("should fail validation for struct table missing .info.meta (missing_meta)", () => {
    const result = validateTable("[struct]missing_meta", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(".info.meta"))).toBe(true);
  });

  it("should fail validation for extend table missing .info.meta (missing_info)", () => {
    const result = validateTable("[extend]missing_info", TEST_DB_PATH);
    expect(result.valid).toBe(false);
  });

  it("should fail validation for resource table missing .desc.meta (missing_desc)", () => {
    const result = validateTable("[resource]missing_desc", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes(".desc.meta"))).toBe(true);
  });

  it("should fail validation for bad directory name (bad_dir_name)", () => {
    const result = validateDirectoryName("bad_dir_name");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should fail validation for invalid JSON in .info.meta (invalid_json)", () => {
    const result = validateTable("[struct]invalid_json", TEST_DB_PATH);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("should validate all valid tables in database", () => {
    const validTables = ["users", "products", "orders", "avatars"];
    const tableTypes: Record<string, string> = {
      users: "struct",
      products: "struct",
      orders: "extend",
      avatars: "resource",
    };

    for (const name of validTables) {
      const prefix = tableTypes[name] === "struct" ? "[struct]" : tableTypes[name] === "extend" ? "[extend]" : "[resource]";
      const result = validateTable(`${prefix}${name}`, TEST_DB_PATH);
      expect(result.valid).toBe(true);
    }
  });
});

console.log("\n🧪 FSDB Schema Validation Tests");
console.log("================================\n");
console.log("Test database path:", TEST_DB_PATH);
console.log("Run with: bun test test/validate-schema.test.ts\n");
