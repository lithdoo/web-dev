#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TEST_DB_PATH = path.resolve(
  __dirname,
  "..",
  "references",
  "examples",
  "create-table"
);

interface TestResult {
  success: boolean;
  tableName: string;
  tableType: string;
  metaFiles: string[];
  error?: string;
}

async function createTestTable(
  type: "struct" | "extend" | "resource",
  tableName: string,
  schema?: Record<string, unknown>,
  extendsDef?: Array<{ field: string; struct: string; desc?: string }>,
  description?: string
): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    tableName,
    tableType: type,
    metaFiles: [],
  };

  try {
    const tablePrefix: Record<string, string> = {
      struct: "[struct]",
      extend: "[extend]",
      resource: "[resource]",
    };

    const tableDirName = `${tablePrefix[type]}${tableName}`;
    const tablePath = path.join(TEST_DB_PATH, tableDirName);

    if (!fs.existsSync(tablePath)) {
      fs.mkdirSync(tablePath, { recursive: true });
    }

    const metaFiles: Record<string, string[]> = {
      struct: [".info.meta"],
      extend: [".info.meta", ".extend.meta"],
      resource: [".desc.meta"],
    };

    for (const metaFile of metaFiles[type]) {
      const metaPath = path.join(tablePath, metaFile);
      let content = "";

      switch (metaFile) {
        case ".info.meta":
          const infoMeta = {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            title: schema?.title || tableName,
            description: schema?.description || "",
            properties: schema?.properties || {},
            required: schema?.required || [],
            ...schema,
          };
          content = JSON.stringify(infoMeta, null, 2);
          break;

        case ".extend.meta":
          const extendLines = (extendsDef || []).map((ext) =>
            JSON.stringify({
              field: ext.field,
              struct: ext.struct,
              desc: ext.desc || "",
            })
          );
          content = extendLines.join("\n");
          break;

        case ".desc.meta":
          content = description || `# ${tableName}\n\nResource table description.`;
          break;
      }

      fs.writeFileSync(metaPath, content, "utf-8");
      result.metaFiles.push(metaFile);
    }

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

async function cleanupTestTables(): Promise<void> {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.rmSync(TEST_DB_PATH, { recursive: true, force: true });
  }
}

describe("FSDB Table Creation", () => {
  beforeAll(async () => {
    await cleanupTestTables();
  });

  it("should create a struct table with valid schema", async () => {
    const schema = {
      title: "Users",
      description: "System users table",
      properties: {
        id: {
          type: "string",
          description: "User unique identifier",
        },
        name: {
          type: "string",
          description: "User name",
        },
        email: {
          type: "string",
          format: "email",
          description: "User email",
        },
      },
      required: ["id", "name", "email"],
    };

    const result = await createTestTable("struct", "users", schema);

    expect(result.success).toBe(true);
    expect(result.tableName).toBe("users");
    expect(result.tableType).toBe("struct");
    expect(result.metaFiles).toContain(".info.meta");

    const infoMetaPath = path.join(TEST_DB_PATH, "[struct]users", ".info.meta");
    expect(fs.existsSync(infoMetaPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(infoMetaPath, "utf-8"));
    expect(content.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(content.type).toBe("object");
    expect(content.required).toContain("id");
    expect(content.required).toContain("name");
    expect(content.required).toContain("email");
  });

  it("should create an extend table with references", async () => {
    const schema = {
      title: "Orders",
      description: "User orders table",
      properties: {
        order_id: {
          type: "string",
          description: "Order unique identifier",
        },
        user_id: {
          type: "string",
          description: "Reference to users table",
        },
        product_id: {
          type: "string",
          description: "Reference to products table",
        },
        quantity: {
          type: "integer",
          description: "Order quantity",
        },
      },
      required: ["order_id", "user_id", "product_id"],
    };

    const extendsDef = [
      { field: "user_id", struct: "users", desc: "下单用户" },
      { field: "product_id", struct: "products", desc: "购买产品" },
    ];

    const result = await createTestTable("extend", "orders", schema, extendsDef);

    expect(result.success).toBe(true);
    expect(result.tableName).toBe("orders");
    expect(result.tableType).toBe("extend");
    expect(result.metaFiles).toContain(".info.meta");
    expect(result.metaFiles).toContain(".extend.meta");

    const extendMetaPath = path.join(TEST_DB_PATH, "[extend]orders", ".extend.meta");
    expect(fs.existsSync(extendMetaPath)).toBe(true);

    const content = fs.readFileSync(extendMetaPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(2);

    const ext1 = JSON.parse(lines[0]);
    expect(ext1.field).toBe("user_id");
    expect(ext1.struct).toBe("users");
    expect(ext1.desc).toBe("下单用户");

    const ext2 = JSON.parse(lines[1]);
    expect(ext2.field).toBe("product_id");
    expect(ext2.struct).toBe("products");
    expect(ext2.desc).toBe("购买产品");
  });

  it("should create a resource table with description", async () => {
    const description = `# 用户头像资源

## 用途
存储系统用户的头像图片。

## 支持格式
- JPG
- PNG
- GIF
- WebP

## 存储限制
- 单文件大小：最大 2MB
- 建议尺寸：200x200 像素`;

    const result = await createTestTable(
      "resource",
      "avatars",
      undefined,
      undefined,
      description
    );

    expect(result.success).toBe(true);
    expect(result.tableName).toBe("avatars");
    expect(result.tableType).toBe("resource");
    expect(result.metaFiles).toContain(".desc.meta");

    const descMetaPath = path.join(TEST_DB_PATH, "[resource]avatars", ".desc.meta");
    expect(fs.existsSync(descMetaPath)).toBe(true);

    const content = fs.readFileSync(descMetaPath, "utf-8");
    expect(content).toContain("# 用户头像资源");
    expect(content).toContain("JPG");
    expect(content).toContain("PNG");
  });

  it("should create multiple tables and verify directory structure", async () => {
    const tables = [
      {
        type: "struct" as const,
        name: "products",
        schema: {
          title: "Products",
          properties: {
            product_id: { type: "string" },
            name: { type: "string" },
            price: { type: "number" },
          },
          required: ["product_id", "name"],
        },
      },
      {
        type: "struct" as const,
        name: "categories",
        schema: {
          title: "Categories",
          properties: {
            category_id: { type: "string" },
            name: { type: "string" },
          },
          required: ["category_id", "name"],
        },
      },
      {
        type: "extend" as const,
        name: "order_items",
        schema: {
          title: "Order Items",
          properties: {
            item_id: { type: "string" },
            order_id: { type: "string" },
            product_id: { type: "string" },
          },
          required: ["item_id", "order_id", "product_id"],
        },
        extendsDef: [
          { field: "order_id", struct: "orders" },
          { field: "product_id", struct: "products" },
        ],
      },
    ];

    for (const table of tables) {
      const result = await createTestTable(
        table.type,
        table.name,
        table.schema,
        table.extendsDef
      );
      expect(result.success).toBe(true);
    }

    expect(fs.existsSync(path.join(TEST_DB_PATH, "[struct]products"))).toBe(true);
    expect(fs.existsSync(path.join(TEST_DB_PATH, "[struct]categories"))).toBe(true);
    expect(fs.existsSync(path.join(TEST_DB_PATH, "[extend]order_items"))).toBe(true);

    const productsMeta = path.join(TEST_DB_PATH, "[struct]products", ".info.meta");
    const categoriesMeta = path.join(TEST_DB_PATH, "[struct]categories", ".info.meta");
    const orderItemsMeta = path.join(TEST_DB_PATH, "[extend]order_items", ".extend.meta");

    expect(fs.existsSync(productsMeta)).toBe(true);
    expect(fs.existsSync(categoriesMeta)).toBe(true);
    expect(fs.existsSync(orderItemsMeta)).toBe(true);
  });
});

console.log("\n🧪 FSDB Table Creation Tests");
console.log("============================\n");
console.log("Test database path:", TEST_DB_PATH);
console.log("Run with: bun test test/create-table.ts\n");