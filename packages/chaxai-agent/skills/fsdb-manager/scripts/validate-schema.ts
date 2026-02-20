#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

interface ValidationResult {
  valid: boolean;
  tableName: string;
  tableType: string;
  errors: string[];
  warnings: string[];
}

interface ValidateOptions {
  dbPath: string;
  tableName?: string;
  strict: boolean;
}

interface TableInfo {
  name: string;
  type: "struct" | "extend" | "resource";
  path: string;
}

function parseArgs(): ValidateOptions {
  const args = process.argv.slice(2);
  const options: ValidateOptions = {
    dbPath: "",
    tableName: undefined,
    strict: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--db":
      case "-d":
        i++;
        options.dbPath = args[i];
        break;
      case "--name":
      case "-n":
        i++;
        options.tableName = args[i];
        break;
      case "--strict":
      case "-s":
        options.strict = true;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
      default:
        if (!arg.startsWith("-")) {
          if (!options.dbPath) options.dbPath = arg;
        }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Usage: validate-schema.ts [options] <dbPath> [tableName]

Options:
  -d, --db <path>       FSDB database root path
  -n, --name <name>     Specific table name to validate (optional)
  -s, --strict          Strict validation mode
  -h, --help            Show this help message

Examples:
  # Validate entire database
  bun validate-schema.ts -d /data/fsdb

  # Validate specific table
  bun validate-schema.ts -d /data/fsdb -n users

  # Strict validation
  bun validate-schema.ts -d /data/fsdb --strict
`);
}

function parseTableName(tableDir: string): TableInfo | null {
  if (tableDir.startsWith("[struct]")) {
    return {
      name: tableDir.slice(8),
      type: "struct",
      path: tableDir,
    };
  } else if (tableDir.startsWith("[extend]")) {
    return {
      name: tableDir.slice(8),
      type: "extend",
      path: tableDir,
    };
  } else if (tableDir.startsWith("[resource]")) {
    return {
      name: tableDir.slice(10),
      type: "resource",
      path: tableDir,
    };
  }
  return null;
}

function getRequiredMetaFiles(type: string): string[] {
  const files: Record<string, string[]> = {
    struct: [".info.meta"],
    extend: [".info.meta", ".extend.meta"],
    resource: [".desc.meta"],
  };
  return files[type] || [];
}

function isValidJSON(content: string): { valid: boolean; error?: string } {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function validateDirectoryName(tableDir: string): string[] {
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

  return errors;
}

function validateInfoMeta(filePath: string): { valid: boolean; errors: string[]; schema?: Record<string, unknown> } {
  const result = { valid: true, errors: [] as string[], schema: undefined as Record<string, unknown> | undefined };

  if (!fs.existsSync(filePath)) {
    result.errors.push(".info.meta file is missing");
    result.valid = false;
    return result;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const parseResult = isValidJSON(content);

  if (!parseResult.valid) {
    result.errors.push(`.info.meta is not valid JSON: ${parseResult.error}`);
    result.valid = false;
    return result;
  }

  const schema = JSON.parse(content);
  result.schema = schema;

  const requiredFields = ["$schema", "type", "properties", "required"];
  for (const field of requiredFields) {
    if (!(schema as Record<string, unknown>)[field]) {
      result.errors.push(`.info.meta is missing required field: ${field}`);
    }
  }

  if ((schema as Record<string, unknown>).$schema !== "http://json-schema.org/draft-07/schema#") {
    result.errors.push(`.info.meta has incorrect $schema version`);
  }

  if ((schema as Record<string, unknown>).type !== "object") {
    result.errors.push(`.info.meta type must be 'object'`);
  }

  const properties = (schema as Record<string, unknown>).properties;
  if (properties && typeof properties !== "object") {
    result.errors.push(`.info.meta properties must be an object`);
  }

  const required = (schema as Record<string, unknown>).required;
  if (required && !Array.isArray(required)) {
    result.errors.push(`.info.meta required must be an array`);
  }

  return result;
}

function validateExtendMeta(
  filePath: string,
  structTables: Map<string, Record<string, unknown>>
): { valid: boolean; errors: string[]; references: Array<{ field: string; struct: string }> } {
  const result = {
    valid: true,
    errors: [] as string[],
    references: [] as Array<{ field: string; struct: string }>,
  };

  if (!fs.existsSync(filePath)) {
    result.errors.push(".extend.meta file is missing");
    result.valid = false;
    return result;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parseResult = isValidJSON(line);
    if (!parseResult.valid) {
      result.errors.push(`.extend.meta line ${i + 1} is not valid JSON: ${parseResult.error}`);
      result.valid = false;
      continue;
    }

    const extDef = JSON.parse(line);
    const requiredFields = ["field", "struct"];
    for (const field of requiredFields) {
      if (!extDef[field]) {
        result.errors.push(`.extend.meta line ${i + 1} is missing required field: ${field}`);
        result.valid = false;
      }
    }

    if (extDef.field && typeof extDef.field !== "string") {
      result.errors.push(`.extend.meta line ${i + 1} 'field' must be a string`);
      result.valid = false;
    }

    if (extDef.struct && typeof extDef.struct !== "string") {
      result.errors.push(`.extend.meta line ${i + 1} 'struct' must be a string`);
      result.valid = false;
    }

    if (extDef.field && extDef.struct) {
      result.references.push({ field: extDef.field, struct: extDef.struct });

      const structTable = structTables.get(extDef.struct);
      if (!structTable) {
        result.errors.push(`.extend.meta references non-existent struct table: ${extDef.struct}`);
        result.valid = false;
      } else {
        const structProps = (structTable.properties as Record<string, unknown>) || {};
        if (!(structProps as Record<string, unknown>)[extDef.field]) {
          result.errors.push(`.extend.meta references field '${extDef.field}' which does not exist in struct '${extDef.struct}'`);
          result.valid = false;
        }
      }
    }
  }

  return result;
}

function validateDescMeta(filePath: string): { valid: boolean; errors: string[] } {
  const result = { valid: true, errors: [] as string[] };

  if (!fs.existsSync(filePath)) {
    result.errors.push(".desc.meta file is missing");
    result.valid = false;
    return result;
  }

  return result;
}

function validateTable(tableDir: string, dbPath: string, strict: boolean): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    tableName: "",
    tableType: "",
    errors: [],
    warnings: [],
  };

  const tableInfo = parseTableName(tableDir);
  if (!tableInfo) {
    result.errors.push(`Invalid table directory name: ${tableDir}`);
    return result;
  }

  result.tableName = tableInfo.name;
  result.tableType = tableInfo.type;

  const nameErrors = validateDirectoryName(tableDir);
  result.errors.push(...nameErrors);
  if (nameErrors.length > 0) {
    result.valid = false;
  }

  const tablePath = path.join(dbPath, tableDir);
  if (!fs.existsSync(tablePath)) {
    result.errors.push(`Table directory does not exist: ${tablePath}`);
    result.valid = false;
    return result;
  }

  const requiredFiles = getRequiredMetaFiles(tableInfo.type);

  for (const requiredFile of requiredFiles) {
    const filePath = path.join(tablePath, requiredFile);
    if (!fs.existsSync(filePath)) {
      result.errors.push(`Required file '${requiredFile}' is missing`);
      result.valid = false;
    }
  }

  if (tableInfo.type === "struct" || tableInfo.type === "extend") {
    const infoMetaPath = path.join(tablePath, ".info.meta");
    const infoResult = validateInfoMeta(infoMetaPath);

    if (!infoResult.valid) {
      result.errors.push(...infoResult.errors);
      result.valid = false;
    }
  }

  if (tableInfo.type === "extend") {
    const extendMetaPath = path.join(tablePath, ".extend.meta");
    const structTables = new Map<string, Record<string, unknown>>();

    const extendResult = validateExtendMeta(extendMetaPath, structTables);
    if (!extendResult.valid) {
      result.errors.push(...extendResult.errors);
      result.valid = false;
    }
  }

  if (tableInfo.type === "resource") {
    const descMetaPath = path.join(tablePath, ".desc.meta");
    const descResult = validateDescMeta(descMetaPath);

    if (!descResult.valid) {
      result.errors.push(...descResult.errors);
      result.valid = false;
    }
  }

  const dataFiles = fs.readdirSync(tablePath).filter(
    (f) => !f.startsWith(".") && f !== ".info.meta" && f !== ".extend.meta" && f !== ".desc.meta"
  );

  if (tableInfo.type === "struct" || tableInfo.type === "extend") {
    const invalidDataFiles = dataFiles.filter((f) => !f.endsWith(".json"));
    if (invalidDataFiles.length > 0) {
      result.errors.push(`Invalid data files found (must be .json): ${invalidDataFiles.join(", ")}`);
      result.valid = false;
    }
  }

  if (tableInfo.type === "resource") {
    const resourceFiles = dataFiles.filter((f) => {
      const ext = path.extname(f);
      return ext && ext !== ".meta";
    });
    if (resourceFiles.length === 0 && strict) {
      result.warnings.push("Resource table has no resource files");
    }
  }

  return result;
}

async function validateDatabase(options: ValidateOptions): Promise<void> {
  const dbPath = path.resolve(options.dbPath);

  if (!fs.existsSync(dbPath)) {
    console.error(`\n❌ Error: Database path does not exist: ${dbPath}`);
    process.exit(1);
  }

  const items = fs.readdirSync(dbPath);
  const tableDirs = items.filter((item) => {
    const itemPath = path.join(dbPath, item);
    return fs.statSync(itemPath).isDirectory();
  });

  const structTables = new Map<string, Record<string, unknown>>();

  for (const tableDir of tableDirs) {
    const tableInfo = parseTableName(tableDir);
    if (!tableInfo) continue;

    if (tableInfo.type === "struct") {
      const infoMetaPath = path.join(dbPath, tableDir, ".info.meta");
      if (fs.existsSync(infoMetaPath)) {
        try {
          const content = fs.readFileSync(infoMetaPath, "utf-8");
          const schema = JSON.parse(content);
          structTables.set(tableInfo.name, schema);
        } catch {
          // Skip invalid schemas
        }
      }
    }
  }

  const results: ValidationResult[] = [];

  for (const tableDir of tableDirs) {
    if (options.tableName) {
      const tableInfo = parseTableName(tableDir);
      if (!tableInfo || tableInfo.name !== options.tableName) continue;
    }

    const result = validateTable(tableDir, dbPath, options.strict);
    results.push(result);
  }

  console.log("\n🔍 FSDB Schema Validation");
  console.log("=========================\n");

  if (options.tableName && results.length === 0) {
    console.log(`❌ Table '${options.tableName}' not found`);
    const availableTables = tableDirs
      .map((d) => parseTableName(d))
      .filter((t) => t !== null)
      .map((t) => t!.path);
    console.log(`Available tables: ${availableTables.join(", ")}`);
    process.exit(1);
  }

  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.valid) {
      passCount++;
      console.log(`✅ [${result.tableType}] ${result.tableName} - VALID`);
    } else {
      failCount++;
      console.log(`❌ [${result.tableType}] ${result.tableName} - INVALID`);
      result.errors.forEach((e) => console.log(`   - ${e}`));
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => console.log(`   ⚠️  ${w}`));
    }
  }

  console.log("\n" + "=".repeat(40));
  console.log(`Total: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (!options.dbPath) {
    console.error("❌ Error: Database path is required (--db)");
    console.error("Run with --help for usage information.");
    process.exit(1);
  }

  await validateDatabase(options);
}

main();
