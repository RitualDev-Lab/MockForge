import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import type { QueryResult, TableMetadata, WasmDatabaseEngine } from './types.js';
import { InMemoryMockDatabase } from './memory-db.js';
import { PostgresExporter } from '../exporters/postgres.js';

export interface DatabaseBridgeOptions {
  preferWasm?: boolean;
}

export class MockDatabaseBridge implements WasmDatabaseEngine {
  private memoryDb: InMemoryMockDatabase;
  private pgliteInstance: any = null;
  private isWasmActive = false;
  private schema: DatabaseSchema | null = null;
  private dataset: RelationalDataset | null = null;

  constructor(schema?: DatabaseSchema, dataset?: RelationalDataset) {
    this.schema = schema || null;
    this.dataset = dataset || null;
    this.memoryDb = new InMemoryMockDatabase(schema, dataset);
  }

  /**
   * Initializes the database, attempting to mount PGlite WASM if available in runtime
   */
  async init(options: DatabaseBridgeOptions = {}): Promise<void> {
    if (options.preferWasm) {
      try {
        // Check for browser window or global PGlite
        let PGliteClass: any = null;
        if (typeof window !== 'undefined' && (window as any).PGlite) {
          PGliteClass = (window as any).PGlite;
        } else {
          // Dynamic import for environments with @electric-sql/pglite installed
          const pkgName = '@electric-sql/pglite';
          const mod: any = await import(/* @vite-ignore */ pkgName).catch(() => null);
          if (mod?.PGlite) {
            PGliteClass = mod.PGlite;
          }
        }

        if (PGliteClass) {
          this.pgliteInstance = new PGliteClass();
          await this.pgliteInstance.waitReady;
          this.isWasmActive = true;

          // If dataset and schema exist, load into WASM
          if (this.dataset && this.schema) {
            await this.loadIntoWasm(this.dataset, this.schema);
          }
          return;
        }
      } catch {
        // Fallback to in-memory DB on WASM initialization failure
        this.isWasmActive = false;
      }
    }

    // Default to high-speed InMemoryMockDatabase
    this.isWasmActive = false;
  }

  async loadDataset(dataset: RelationalDataset): Promise<void> {
    this.dataset = dataset;
    this.memoryDb.loadDataset(dataset);

    if (this.isWasmActive && this.pgliteInstance && this.schema) {
      await this.loadIntoWasm(dataset, this.schema);
    }
  }

  async query(sql: string): Promise<QueryResult> {
    if (this.isWasmActive && this.pgliteInstance) {
      const startTime = performance.now();
      const res = await this.pgliteInstance.query(sql);
      const rows = res.rows || [];
      const columns = res.fields ? res.fields.map((f: any) => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
      return {
        rows,
        columns,
        rowCount: rows.length,
        durationMs: performance.now() - startTime
      };
    }

    return this.memoryDb.query(sql);
  }

  getTables(): TableMetadata[] {
    return this.memoryDb.getTables();
  }

  isWasm(): boolean {
    return this.isWasmActive;
  }

  private async loadIntoWasm(dataset: RelationalDataset, schema: DatabaseSchema): Promise<void> {
    const seedScript = PostgresExporter.exportInsert(dataset, schema);
    await this.pgliteInstance.exec(seedScript.content);
  }
}

/**
 * Creates an in-browser / in-memory interactive mock database pre-loaded with data
 */
export async function createMockDatabase(
  schema?: DatabaseSchema,
  dataset?: RelationalDataset,
  options?: DatabaseBridgeOptions
): Promise<MockDatabaseBridge> {
  const bridge = new MockDatabaseBridge(schema, dataset);
  await bridge.init(options);
  return bridge;
}
