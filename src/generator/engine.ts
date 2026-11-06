import type { DatabaseSchema, TableDefinition, ForeignKeyReference } from '../types/schema.js';
import type { SchemaSemanticProfiles, SchemaInferenceResult } from '../inference/types.js';
import { DependencyGraph } from '../graph/dag.js';
import { SeededPRNG } from './prng.js';
import { GeneratorRegistry } from './registry.js';
import { PrimaryKeyPool } from './relational-pool.js';
import { ConstraintSolver } from './constraints.js';

export interface GenerationOptions {
  seed?: number;
  defaultRowCount?: number;
  rowCounts?: Record<string, number>; // Table name (case-insensitive) -> row count
  nullProbability?: number;
  semanticProfiles?: SchemaSemanticProfiles | SchemaInferenceResult;
}

export interface RelationalDataset {
  tables: Record<string, Record<string, any>[]>;
  executionOrder: string[];
  totalRows: number;
  durationMs: number;
  seed: number;
}

export class RelationalSynthesisEngine {
  private schema: DatabaseSchema;
  private prng: SeededPRNG;
  private pool: PrimaryKeyPool;
  private options: Required<Omit<GenerationOptions, 'semanticProfiles'>> & {
    semanticProfiles?: SchemaSemanticProfiles;
  };

  constructor(schema: DatabaseSchema, options: GenerationOptions = {}) {
    this.schema = schema;
    let profiles: SchemaSemanticProfiles | undefined;
    if (options.semanticProfiles) {
      if ('profiles' in options.semanticProfiles) {
        profiles = options.semanticProfiles.profiles as SchemaSemanticProfiles;
      } else {
        profiles = options.semanticProfiles as SchemaSemanticProfiles;
      }
    }

    this.options = {
      seed: options.seed ?? 42,
      defaultRowCount: options.defaultRowCount ?? 50,
      rowCounts: options.rowCounts ?? {},
      nullProbability: options.nullProbability ?? 0.05,
      semanticProfiles: profiles
    };
    this.prng = new SeededPRNG(this.options.seed);
    this.pool = new PrimaryKeyPool();
  }

  /**
   * Synthesizes referentially intact relational mock data in dependency order
   */
  generate(): RelationalDataset {
    const startTime = performance.now();
    this.pool.clear();

    const graph = new DependencyGraph(this.schema);
    const { executionOrder, steps } = graph.resolveExecutionOrder();

    const dataset: Record<string, Record<string, any>[]> = {};
    let totalRowCount = 0;

    // Phase 1: Dependency-Ordered Primary Generation
    for (const step of steps) {
      const table = this.schema.tables.find((t) => t.name.toLowerCase() === step.tableName.toLowerCase());
      if (!table) continue;

      const count = this.getTargetRowCount(table.name);
      const rows: Record<string, any>[] = [];

      for (let rowIndex = 0; rowIndex < count; rowIndex++) {
        const row: Record<string, any> = {};

        for (const col of table.columns) {
          // Check if column is a Foreign Key
          if (col.foreignKey) {
            const isDeferred = step.deferredForeignKeys.some(
              (dfk) => dfk.sourceColumn.toLowerCase() === col.name.toLowerCase()
            );

            if (isDeferred) {
              row[col.name] = null; // Populated in 2nd deferred pass
            } else {
              row[col.name] = this.pool.sampleParentKey(
                col.foreignKey.targetTable,
                this.prng,
                col.isNullable,
                this.options.nullProbability
              );
            }
          } else {
            // Check for AI or locally inferred semantic column profile
            const tableProfiles = this.options.semanticProfiles?.[table.name.toLowerCase()];
            const semanticProfile = tableProfiles?.[col.name.toLowerCase()] || null;

            // Generate contextual value via Generator Registry
            row[col.name] = GeneratorRegistry.generateValue(col, this.prng, {
              tableName: table.name,
              rowIndex,
              currentRow: row,
              semanticProfile
            });
          }
        }

        // Enforce temporal and arithmetic cross-column constraints
        ConstraintSolver.enforce(row, table, this.prng);

        // Record Primary Key to the Referential Pool for dependent child tables
        this.pool.recordRow(table.name, row, table.primaryKey);
        rows.push(row);
      }

      dataset[table.name] = rows;
      totalRowCount += count;
    }

    // Phase 2: Deferred Secondary Pass for Self-References & Broken Circular Keys
    for (const step of steps) {
      if (step.deferredForeignKeys.length === 0) continue;
      const rows = dataset[step.tableName];
      if (!rows || rows.length === 0) continue;

      for (const fk of step.deferredForeignKeys) {
        const isSelfReference = fk.targetTable.toLowerCase() === step.tableName.toLowerCase();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (isSelfReference) {
            // Self-reference (e.g. users.manager_id): root row (index 0) remains null (CEO), others link to previous rows
            if (i === 0) {
              row[fk.sourceColumn] = null;
            } else {
              // Sample a manager strictly from previously created employees to prevent circular tree loops
              const targetRows = rows.slice(0, i);
              const parentPkCol = fk.targetColumn || 'id';
              const manager = this.prng.pick(targetRows);
              row[fk.sourceColumn] = manager[parentPkCol];
            }
          } else {
            // Circular broken FK: link to target table now that all rows exist
            row[fk.sourceColumn] = this.pool.sampleParentKey(
              fk.targetTable,
              this.prng,
              fk.isNullable,
              this.options.nullProbability
            );
          }
        }
      }
    }

    const durationMs = performance.now() - startTime;

    return {
      tables: dataset,
      executionOrder,
      totalRows: totalRowCount,
      durationMs,
      seed: this.options.seed
    };
  }

  private getTargetRowCount(tableName: string): number {
    const lower = tableName.toLowerCase();
    for (const [key, val] of Object.entries(this.options.rowCounts)) {
      if (key.toLowerCase() === lower) {
        return Math.max(0, val);
      }
    }
    return this.options.defaultRowCount;
  }
}
