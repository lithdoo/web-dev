#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

interface TableOptions {
  type: "struct" | "extend" | "resource";
  dbPath: string;
  tableName: string;
  force: boolean;
  schema?: Record<string, unknown>;
  extends?: Array<{ field: string; struct: string; desc?: string }>;
  description?: string;
}

interface TableValidation {
  valid: boolean;
  errors: string[];
}

const STRUCT_REQUIRED_FIELDS = ["$schema", "type", "properties", "required"];
const EXTEND_REQUIRED_FIELDS = ["field", "struct"];

function parseArgs(): TableOptions {
  const args = process.argv.slice(2);
  const options: TableOptions = {
    type: "struct",
    dbPath: "",
    tableName: "",
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--type":
      case "-t":
        i++;
        options.type = args[i] as "struct" | "extend" | "resource";
        break;
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
      case "--force":
      case "-f":
        options.force = true;
        break;
      case "--schema":
      case "-s":
        i++;
        try {
          options.schema = JSON.parse(args[i]);
        } catch {
          console.error("Invalid JSON schema provided");
          process.exit(1);
        }
        break;
      case "--extends":
      case "-e":
        i++;
        try {
          options.extends = JSON.parse(args[i]);
        } catch {
          console.error("Invalid JSON for extends provided");
          process.exit(1);
        }
        break;
      case "--desc":
      case "-c":
        i++;
        options.description = args[i];
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
      default:
        if (!arg.startsWith("-")) {
          if (!options.dbPath) options.dbPath = arg;
          else if (!options.tableName) options.tableName = arg;
        }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Usage: create-table.ts [options] <dbPath> <tableName>

Options:
  -t, --type <type>     Table type: struct, extend, resource (default: struct)
  -d, --db <path>       FSDB database root path
  -n, --name <name>     Table name (without prefix)
  -s, --schema <json>   JSON Schema for struct/extend tables (JSON string)
  -e, --extends <json>  Extend definitions for extend tables (JSON array)
  -c, --desc <text>     Description for resource table (Markdown text or path to file)
  -f, --force           Overwrite existing table metadata without prompting
  -h, --help            Show this help message

Examples:
  # Create a struct table with inline schema
  bun create-table.ts -d /data/fsdb -n users -t struct \\
    -s '{"properties":{"id":{"type":"string"}},"required":["id"]}'

  # Create an extend table with references
  bun create-table.ts -d /data/fsdb -n orders -t extend \\
    -s '{"properties":{"order_id":{"type":"string"}},"required":["order_id"]}' \\
    -e '[{"field":"user_id","struct":"users"}]'

  # Create a resource table
  bun create-table.ts -d /data/fsdb -n avatars -t resource \\
    -c '# User Avatars\\n\\nStore user profile images.'
`);
}

function validateTableOptions(options: TableOptions): TableValidation {
  const errors: string[] = [];

  if (!options.dbPath) {
    errors.push("Database path is required (--db)");
  }

  if (!options.tableName) {
    errors.push("Table name is required (--name)");
  }

  if (!["struct", "extend", "resource"].includes(options.type)) {
    errors.push("Invalid table type. Must be: struct, extend, resource");
  }

  switch (options.type) {
    case "struct":
      if (!options.schema) {
        errors.push("Struct table requires schema (--schema)");
      } else if (options.schema) {
        const missingFields = STRUCT_REQUIRED_FIELDS.filter(
          (f) => !(options.schema as Record<string, unknown>)[f]
        );
        if (missingFields.length > 0) {
          errors.push(
            `Struct schema missing required fields: ${missingFields.join(", ")}`
          );
        }
      }
      break;

    case "extend":
      if (!options.schema) {
        errors.push("Extend table requires schema (--schema)");
      } else {
        const missingFields = STRUCT_REQUIRED_FIELDS.filter(
          (f) => !(options.schema as Record<string, unknown>)[f]
        );
        if (missingFields.length > 0) {
          errors.push(
            `Extend schema missing required fields: ${missingFields.join(", ")}`
          );
        }
      }
      if (!options.extends || options.extends.length === 0) {
        errors.push("Extend table requires extends definition (--extends)");
      } else {
        for (let i = 0; i < options.extends.length; i++) {
          const ext = options.extends[i];
          const missingFields = EXTEND_REQUIRED_FIELDS.filter(
            (f) => !ext[f as keyof typeof ext]
          );
          if (missingFields.length > 0) {
            errors.push(
              `Extend definition[${i}] missing required fields: ${missingFields.join(", ")}`
            );
          }
        }
      }
      break;

    case "resource":
      if (!options.description) {
        errors.push("Resource table requires description (--desc)");
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function getTablePrefix(type: string): string {
  const prefixes: Record<string, string> = {
    struct: "[struct]",
    extend: "[extend]",
    resource: "[resource]",
  };
  return prefixes[type] || "[struct]";
}

function getTableDirName(type: string, name: string): string {
  return `${getTablePrefix(type)}${name}`;
}

function tableExists(tablePath: string): boolean {
  return fs.existsSync(tablePath);
}

function getMetaFilesForType(type: string): string[] {
  const files: Record<string, string[]> = {
    struct: [".info.meta"],
    extend: [".info.meta", ".extend.meta"],
    resource: [".desc.meta"],
  };
  return files[type] || [];
}

async function promptUserConfirmation(tablePath: string, tableType: string): Promise<boolean> {
  console.log(`\n⚠️  Table already exists at: ${tablePath}`);
  console.log(`Type: ${tableType}`);

  const metaFiles = getMetaFilesForType(tableType);
  console.log(`Metadata files to update: ${metaFiles.join(", ")}`);

  console.log("\nExisting data files will NOT be modified.");
  console.log("Only metadata files will be updated.\n");

  const rl = (await import("node:readline")).createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Do you want to continue? (y/N): ", (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase().startsWith("y");
      resolve(confirmed);
    });
  });
}

function createStructMeta(schema: Record<string, unknown>): string {
  const infoMeta = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    title: schema.title || "Table",
    description: schema.description || "",
    properties: schema.properties || {},
    required: schema.required || [],
    ...schema,
  };

  return JSON.stringify(infoMeta, null, 2);
}

function createExtendMeta(
  schema: Record<string, unknown>,
  extendsDef: Array<{ field: string; struct: string; desc?: string }>
): string {
  const infoMeta = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    title: schema.title || "Extend Table",
    description: schema.description || "",
    properties: schema.properties || {},
    required: schema.required || [],
    ...schema,
  };

  const extendLines = extendsDef.map((ext) =>
    JSON.stringify({
      field: ext.field,
      struct: ext.struct,
      desc: ext.desc || "",
    })
  );

  return extendLines.join("\n");
}

function createResourceMeta(description: string): string {
  let descContent = description;

  if (fs.existsSync(description)) {
    try {
      descContent = fs.readFileSync(description, "utf-8");
    } catch {
      console.warn(`Could not read description file: ${description}`);
    }
  }

  return descContent;
}

async function createTable(options: TableOptions): Promise<void> {
  const dbPath = path.resolve(options.dbPath);
  const tableDirName = getTableDirName(options.type, options.tableName);
  const tablePath = path.join(dbPath, tableDirName);

  console.log(`\n📁 Creating ${options.type} table: ${tableDirName}`);
  console.log(`   Path: ${tablePath}`);

  const exists = tableExists(tablePath);

  if (exists && !options.force) {
    const confirmed = await promptUserConfirmation(tablePath, options.type);
    if (!confirmed) {
      console.log("\n❌ Operation cancelled.");
      process.exit(0);
    }
  }

  if (!exists) {
    console.log(`\n📂 Creating table directory...`);
    fs.mkdirSync(tablePath, { recursive: true });
    console.log(`   ✅ Directory created`);
  } else {
    console.log(`\n🔄 Updating existing table metadata...`);
  }

  const metaFiles = getMetaFilesForType(options.type);

  for (const metaFile of metaFiles) {
    const metaPath = path.join(tablePath, metaFile);
    let content = "";

    switch (metaFile) {
      case ".info.meta":
        content = createStructMeta(options.schema!);
        break;
      case ".extend.meta":
        content = createExtendMeta(options.schema!, options.extends!);
        break;
      case ".desc.meta":
        content = createResourceMeta(options.description!);
        break;
    }

    fs.writeFileSync(metaPath, content, "utf-8");
    console.log(`   ✅ Created/Updated: ${metaFile}`);
  }

  console.log(`\n✨ Table "${tableDirName}" created/updated successfully!`);
  console.log(`\nMetadata files created:`);
  metaFiles.forEach((f) => {
    console.log(`   - ${path.join(tablePath, f)}`);
  });

  const dataFiles = fs
    .readdirSync(tablePath)
    .filter((f) => f.endsWith(".json") || !f.startsWith("."))
    .filter((f) => !metaFiles.includes(f));

  if (dataFiles.length > 0) {
    console.log(`\n📄 Existing data files (preserved):`);
    dataFiles.forEach((f) => console.log(`   - ${f}`));
  }
}

async function main(): Promise<void> {
  console.log("🚀 FSDB Table Creator");
  console.log("=====================\n");

  const options = parseArgs();

  const validation = validateTableOptions(options);
  if (!validation.valid) {
    console.error("❌ Validation errors:");
    validation.errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  try {
    await createTable(options);
  } catch (error) {
    console.error("\n❌ Error creating table:", error);
    process.exit(1);
  }
}

main();
