#!/usr/bin/env bun

import * as fs from "node:fs";
import * as path from "node:path";

interface DeleteOptions {
  dbPath: string;
  tableName: string;
  force: boolean;
}

function parseArgs(): DeleteOptions {
  const args = process.argv.slice(2);
  const options: DeleteOptions = {
    dbPath: "",
    tableName: "",
    force: false,
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
      case "--force":
      case "-f":
        options.force = true;
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
Usage: delete-table.ts [options] <dbPath> <tableName>

Options:
  -d, --db <path>       FSDB database root path
  -n, --name <name>     Table name (without prefix)
  -f, --force           Delete table without prompting for confirmation
  -h, --help            Show this help message

Examples:
  # Delete a table with confirmation
  bun delete-table.ts -d /data/fsdb -n users

  # Delete a table without confirmation
  bun delete-table.ts -d /data/fsdb -n users --force
`);
}

function getTablePrefixes(): Record<string, string[]> {
  return {
    struct: ["[struct]"],
    extend: ["[extend]"],
    resource: ["[resource]"],
  };
}

function findTablePath(dbPath: string, tableName: string): string | null {
  const prefixes = getTablePrefixes();
  
  for (const type of Object.keys(prefixes)) {
    for (const prefix of prefixes[type as keyof typeof prefixes]) {
      const tablePath = path.join(dbPath, `${prefix}${tableName}`);
      if (fs.existsSync(tablePath)) {
        return tablePath;
      }
    }
  }

  return null;
}

async function promptUserConfirmation(tablePath: string, tableName: string): Promise<boolean> {
  console.log(`\n⚠️  You are about to delete table: ${tableName}`);
  console.log(`    Path: ${tablePath}`);

  const stats = fs.statSync(tablePath);
  const itemCount = fs.readdirSync(tablePath).filter(f => !f.startsWith(".")).length;

  console.log(`    Items: ${itemCount} files/directories`);
  console.log(`    Modified: ${stats.mtime.toLocaleString()}`);

  console.log("\n⚠️  This action CANNOT be undone!");
  console.log("    All data files and metadata will be permanently deleted.\n");

  const rl = (await import("node:readline")).createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Are you sure you want to delete this table? (type 'yes' to confirm): ", (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase() === "yes";
      resolve(confirmed);
    });
  });
}

async function deleteTable(options: DeleteOptions): Promise<void> {
  const dbPath = path.resolve(options.dbPath);

  if (!fs.existsSync(dbPath)) {
    console.error(`\n❌ Error: Database path does not exist: ${dbPath}`);
    process.exit(1);
  }

  if (!options.tableName) {
    console.error("\n❌ Error: Table name is required (--name)");
    console.error("Run with --help for usage information.");
    process.exit(1);
  }

  const tablePath = findTablePath(dbPath, options.tableName);

  if (!tablePath) {
    console.error(`\n❌ Error: Table '${options.tableName}' not found in ${dbPath}`);
    console.error("Available tables:");
    
    const items = fs.readdirSync(dbPath).filter(item => 
      item.startsWith("[struct]") || item.startsWith("[extend]") || item.startsWith("[resource]")
    );
    
    if (items.length === 0) {
      console.error("  (no tables found)");
    } else {
      items.forEach(item => console.error(`  - ${item}`));
    }
    process.exit(1);
  }

  const tableDir = path.basename(tablePath);
  const tableType = tableDir.startsWith("[struct]") ? "struct" :
                    tableDir.startsWith("[extend]") ? "extend" :
                    tableDir.startsWith("[resource]") ? "resource" : "unknown";

  console.log(`\n🗑️  Deleting ${tableType} table: ${tableDir}`);
  console.log(`    Path: ${tablePath}`);

  if (!options.force) {
    const confirmed = await promptUserConfirmation(tablePath, options.tableName);
    if (!confirmed) {
      console.log("\n❌ Operation cancelled.");
      process.exit(0);
    }
  } else {
    console.log("\n🔄 Force delete mode - skipping confirmation.");
  }

  try {
    fs.rmSync(tablePath, { recursive: true, force: true });
    console.log(`\n✨ Table '${tableDir}' deleted successfully!`);
  } catch (error) {
    console.error("\n❌ Error deleting table:", error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log("🚀 FSDB Table Deleter");
  console.log("=====================\n");

  const options = parseArgs();

  if (!options.dbPath) {
    console.error("❌ Error: Database path is required (--db)");
    console.error("Run with --help for usage information.");
    process.exit(1);
  }

  try {
    await deleteTable(options);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
