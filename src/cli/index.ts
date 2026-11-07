import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseSchema, synthesizeMockData, inferSchemaSemantics, runMockForgeMcpServer } from '../index.js';
import { exportDataset, type ExportFormat } from '../exporters/index.js';
import { LicenseManager } from '../licensing/commercial.js';
import { InMemoryMockDatabase } from '../wasm/memory-db.js';

export interface CliArgs {
  command?: string;
  schema?: string;
  format?: string;
  out?: string;
  rows?: number;
  seed?: number;
  apiKey?: string;
  licenseKey?: string;
  sql?: string;
  help?: boolean;
  version?: boolean;
}

export class MockForgeCli {
  static readonly VERSION = '0.1.1';

  /**
   * Main CLI entrypoint
   */
  static async run(argv: string[]): Promise<number> {
    const args = this.parseArgs(argv);

    if (args.version) {
      console.log(`MockForge AI CLI v${this.VERSION} (Enterprise Relational Mock Engine)`);
      return 0;
    }

    if (args.help || !args.command || args.command === 'help') {
      this.printHelp();
      return 0;
    }

    try {
      switch (args.command) {
        case 'generate':
          return await this.handleGenerate(args);

        case 'infer':
          return await this.handleInfer(args);

        case 'query':
          return await this.handleQuery(args);

        case 'mcp':
        case 'serve':
          await runMockForgeMcpServer();
          return 0;

        default:
          console.error(`Unknown command: '${args.command}'. Run 'mockforge --help' for usage.`);
          return 1;
      }
    } catch (err: any) {
      console.error(`[MockForge CLI Error] ${err.message || err}`);
      return 1;
    }
  }

  private static async handleGenerate(args: CliArgs): Promise<number> {
    if (!args.schema) {
      console.error('Error: --schema <path> is required for generate command.');
      return 1;
    }

    const schemaPath = resolve(process.cwd(), args.schema);
    const schemaContent = readFileSync(schemaPath, 'utf-8');

    console.log(`[MockForge] Parsing schema: ${args.schema}...`);
    const schema = parseSchema(schemaContent);
    console.log(`  ✓ Detected ${schema.tables.length} tables (${schema.dialect.toUpperCase()})`);

    const license = LicenseManager.getLicense(args.licenseKey);
    const targetRows = args.rows ?? 50;
    LicenseManager.validateRowCount(targetRows, license);

    console.log(`[MockForge] Resolving column semantics (${args.apiKey ? 'Gemini 1.5 Flash' : 'Local Rules Engine'})...`);
    const semanticResult = await inferSchemaSemantics(schema, {
      apiKey: args.apiKey,
      forceLocal: !args.apiKey
    });
    console.log(`  ✓ Inferred ${semanticResult.inferredColumnsCount} semantic column profiles (${semanticResult.source})`);

    console.log(`[MockForge] Synthesizing ${targetRows} relational rows per table (Seed: ${args.seed ?? 42})...`);
    const dataset = synthesizeMockData(schema, {
      seed: args.seed ?? 42,
      defaultRowCount: targetRows,
      semanticProfiles: semanticResult
    });
    console.log(`  ✓ Generated ${dataset.totalRows.toLocaleString()} coherent records in ${dataset.durationMs.toFixed(2)}ms`);

    const format = (args.format?.toLowerCase() || 'postgres') as ExportFormat;
    console.log(`[MockForge] Exporting dataset to format: ${format.toUpperCase()}...`);
    const bundle = exportDataset(dataset, schema, { format });

    if (args.out) {
      const outPath = resolve(process.cwd(), args.out);
      mkdirSync(dirname(outPath), { recursive: true });

      if (bundle.files.length === 1) {
        writeFileSync(outPath, bundle.primaryFile.content, 'utf-8');
        console.log(`  ✓ Wrote ${bundle.primaryFile.sizeBytes.toLocaleString()} bytes to: ${outPath}`);
      } else {
        // Multi-file export (e.g. CSV or JSON)
        mkdirSync(outPath, { recursive: true });
        for (const file of bundle.files) {
          const filePath = resolve(outPath, file.filename);
          writeFileSync(filePath, file.content, 'utf-8');
        }
        console.log(`  ✓ Wrote ${bundle.files.length} files (${bundle.totalBytes.toLocaleString()} bytes) to: ${outPath}`);
      }
    } else {
      console.log('\n--- EXPORTED SCRIPT PREVIEW (First 25 lines) ---');
      const preview = bundle.primaryFile.content.split('\n').slice(0, 25).join('\n');
      console.log(preview);
      console.log('...\n(Pass --out <path> to save complete script to file)');
    }

    return 0;
  }

  private static async handleInfer(args: CliArgs): Promise<number> {
    if (!args.schema) {
      console.error('Error: --schema <path> is required for infer command.');
      return 1;
    }

    const schemaPath = resolve(process.cwd(), args.schema);
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = parseSchema(schemaContent);

    console.log(`[MockForge] Inferring semantic profiles for ${schema.tables.length} tables...`);
    const result = await inferSchemaSemantics(schema, {
      apiKey: args.apiKey,
      forceLocal: !args.apiKey
    });

    const json = JSON.stringify(result, null, 2);
    if (args.out) {
      const outPath = resolve(process.cwd(), args.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, json, 'utf-8');
      console.log(`✓ Saved semantic profiles to: ${outPath}`);
    } else {
      console.log(json);
    }

    return 0;
  }

  private static async handleQuery(args: CliArgs): Promise<number> {
    if (!args.schema || !args.sql) {
      console.error('Error: Both --schema <path> and --sql "<query>" are required for query command.');
      return 1;
    }

    const schemaPath = resolve(process.cwd(), args.schema);
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = parseSchema(schemaContent);

    const semanticResult = await inferSchemaSemantics(schema, {
      apiKey: args.apiKey,
      forceLocal: !args.apiKey
    });

    const dataset = synthesizeMockData(schema, {
      seed: args.seed ?? 42,
      defaultRowCount: args.rows ?? 20,
      semanticProfiles: semanticResult
    });

    const db = new InMemoryMockDatabase(schema, dataset);
    console.log(`[MockForge] Running SQL against in-memory mock database:`);
    console.log(`  > ${args.sql}\n`);

    const result = db.query(args.sql);
    console.table(result.rows);
    console.log(`✓ Returned ${result.rowCount} rows in ${result.durationMs.toFixed(2)}ms`);

    return 0;
  }

  private static parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {};
    const tokens = argv.slice(2);

    if (tokens.length === 0) return { help: true };

    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];

      if (t === '--version' || t === '-v') {
        args.version = true;
      } else if (t === '--help' || t === '-h') {
        args.help = true;
      } else if (t === '--schema' || t === '-s') {
        args.schema = tokens[++i];
      } else if (t === '--format' || t === '-f') {
        args.format = tokens[++i];
      } else if (t === '--out' || t === '-o') {
        args.out = tokens[++i];
      } else if (t === '--rows' || t === '-r') {
        args.rows = parseInt(tokens[++i], 10);
      } else if (t === '--seed') {
        args.seed = parseInt(tokens[++i], 10);
      } else if (t === '--api-key') {
        args.apiKey = tokens[++i];
      } else if (t === '--license-key') {
        args.licenseKey = tokens[++i];
      } else if (t === '--sql' || t === '-q') {
        args.sql = tokens[++i];
      } else if (!t.startsWith('-') && !args.command) {
        args.command = t;
      }
      i++;
    }

    return args;
  }

  private static printHelp(): void {
    console.log(`
MockForge AI CLI — Instant Relational Mock Database Engine
Version: ${this.VERSION} | Proprietary Closed-Source Enterprise Edition

USAGE:
  mockforge <command> [options]

COMMANDS:
  generate    Synthesizes relational mock data from SQL or Prisma schema
  infer       Infers semantic column profiles (Gemini 1.5 Flash / Local Rules)
  query       Executes an interactive SQL query against mock data in terminal
  mcp         Starts Model Context Protocol (MCP) stdio server
  help        Prints this help screen

OPTIONS:
  -s, --schema <path>      Path to input SQL DDL or Prisma schema file
  -f, --format <format>    Export format: postgres | postgres-copy | mysql | sqlite | prisma | drizzle | csv | json (default: postgres)
  -o, --out <path>         Output destination file or directory
  -r, --rows <count>       Target row count per table (default: 50)
      --seed <number>      PRNG seed for deterministic reproducibility (default: 42)
      --api-key <key>      Gemini 1.5 Flash API Key ($0 Tier) for semantic column inference
      --license-key <key>  MockForge Team or Enterprise commercial license key
  -q, --sql <query>        SQL statement to execute in query command
  -v, --version            Display version
  -h, --help               Display help information

EXAMPLES:
  # Generate 500 rows of Postgres seed data:
  mockforge generate --schema ./schema.sql --format postgres --out ./seed.sql --rows 500

  # Generate Prisma ORM seed script:
  mockforge generate --schema ./prisma/schema.prisma --format prisma --out ./prisma/seed.ts

  # Query mock relational database directly in terminal:
  mockforge query --schema ./schema.sql --sql "SELECT * FROM users WHERE role = 'admin'"
`);
  }
}
