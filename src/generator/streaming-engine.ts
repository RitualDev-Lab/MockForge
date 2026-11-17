import type { DatabaseSchema, TableDefinition, ForeignKeyReference } from '../types/schema.js';
import { DependencyGraph } from '../graph/dag.js';
import { SeededPRNG } from './prng.js';
import { GeneratorRegistry } from './registry.js';
import { PrimaryKeyPool } from './relational-pool.js';
import type { DebeziumCdcEnvelope } from '../exporters/cdc.js';

export interface StreamGenerationOptions {
  seed?: number;
  rowCounts: Record<string, number>;
  batchSize?: number;
  nullProbability?: number;
}

export interface StreamMetrics {
  totalRowsGenerated: number;
  durationMs: number;
  throughputRowsPerSec: number;
  tablesCount: number;
  circularEdgesResolved: number;
}

export class HighThroughputStreamingEngine {
  private schema: DatabaseSchema;
  private prng: SeededPRNG;
  private pool: PrimaryKeyPool;
  private options: Required<StreamGenerationOptions>;

  constructor(schema: DatabaseSchema, options: StreamGenerationOptions) {
    this.schema = schema;
    this.options = {
      seed: options.seed ?? 42,
      rowCounts: options.rowCounts,
      batchSize: options.batchSize ?? 1000,
      nullProbability: options.nullProbability ?? 0.05,
    };
    this.prng = new SeededPRNG(this.options.seed);
    this.pool = new PrimaryKeyPool();
  }

  /**
   * High-throughput streaming synthesis generating records at 100,000+ rows/sec
   * with automatic circular foreign key resolution and CDC Debezium event streaming
   */
  public async streamDebeziumEvents(
    onEvent: (event: DebeziumCdcEnvelope) => void | Promise<void>,
  ): Promise<StreamMetrics> {
    const startTime = performance.now();
    this.pool.clear();

    const graph = new DependencyGraph(this.schema);
    const { executionOrder, steps } = graph.resolveExecutionOrder();

    let totalRows = 0;
    let circularEdgesResolved = 0;
    const now = Date.now();

    const deferredPatchQueue: Array<{
      tableName: string;
      row: Record<string, any>;
      deferredFk: ForeignKeyReference;
    }> = [];

    // Phase 1: High-Speed Streaming Pass
    for (const step of steps) {
      const table = this.schema.tables.find(
        (t) => t.name.toLowerCase() === step.tableName.toLowerCase(),
      );
      if (!table) continue;

      const targetCount = this.options.rowCounts[table.name] ?? this.options.rowCounts[step.tableName] ?? 1000;
      const columns = table.columns;
      const colLen = columns.length;
      const pkCol = table.primaryKey || 'id';

      // Pre-compile schema struct & source metadata ONCE per table
      const cachedSchemaStruct = {
        type: 'struct' as const,
        name: `io.debezium.connector.postgresql.${table.name}.Envelope`,
        fields: columns.map((col) => ({
          type: (col.rawType || col.normalizedType || 'string').toLowerCase().includes('int') ? 'int64' : 'string',
          optional: col.isNullable,
          field: col.name,
        })),
      };

      const cachedSource = {
        version: '2.5.0.Final',
        connector: 'postgresql',
        db: 'mockforge_enterprise',
        table: table.name,
        ts_ms: now,
      };

      // Pre-compile column handlers
      const colHandlers = columns.map((col) => {
        const isFk = Boolean(col.foreignKey);
        const isDeferred = isFk && step.deferredForeignKeys.some(
          (dfk) => dfk.sourceColumn.toLowerCase() === col.name.toLowerCase(),
        );

        return {
          col,
          isFk,
          isDeferred,
        };
      });

      for (let i = 0; i < targetCount; i++) {
        const row: Record<string, any> = {};

        for (let c = 0; c < colLen; c++) {
          const h = colHandlers[c];
          const col = h.col;

          if (h.isFk) {
            if (h.isDeferred) {
              row[col.name] = null;
              deferredPatchQueue.push({
                tableName: table.name,
                row,
                deferredFk: col.foreignKey!,
              });
            } else {
              row[col.name] = this.pool.sampleParentKey(
                col.foreignKey!.targetTable,
                this.prng,
                col.isNullable,
                this.options.nullProbability,
              );
            }
          } else {
            row[col.name] = GeneratorRegistry.generateValue(col, this.prng, {
              tableName: table.name,
              rowIndex: i,
              currentRow: row,
            });
          }
        }

        // Record PK into fast lookup pool
        this.pool.recordRow(table.name, row, pkCol);

        // Emit Debezium Insert Event ('c')
        const event: DebeziumCdcEnvelope = {
          schema: cachedSchemaStruct,
          payload: {
            before: null,
            after: row,
            source: cachedSource,
            op: 'c',
            ts_ms: now,
          },
        };

        onEvent(event);
        totalRows++;
      }
    }

    // Phase 2: Circular Foreign Key Resolution via CDC Update Events ('u')
    for (const patch of deferredPatchQueue) {
      const beforeState = { ...patch.row };
      const sampledKey = this.pool.sampleParentKey(
        patch.deferredFk.targetTable,
        this.prng,
        patch.deferredFk.isNullable,
        0,
      );

      patch.row[patch.deferredFk.sourceColumn] = sampledKey;
      circularEdgesResolved++;

      const updateEvent: DebeziumCdcEnvelope = {
        schema: {
          type: 'struct',
          name: `io.debezium.connector.postgresql.${patch.tableName}.Envelope`,
          fields: Object.keys(patch.row).map((k) => ({
            type: typeof patch.row[k] === 'number' ? 'int64' : 'string',
            optional: true,
            field: k,
          })),
        },
        payload: {
          before: beforeState,
          after: patch.row,
          source: {
            version: '2.5.0.Final',
            connector: 'postgresql',
            db: 'mockforge_enterprise',
            table: patch.tableName,
            ts_ms: now + 1,
          },
          op: 'u',
          ts_ms: now + 1,
        },
      };

      onEvent(updateEvent);
    }

    const durationMs = performance.now() - startTime;
    const throughputRowsPerSec = Math.round((totalRows / (durationMs / 1000)));

    return {
      totalRowsGenerated: totalRows,
      durationMs,
      throughputRowsPerSec,
      tablesCount: executionOrder.length,
      circularEdgesResolved,
    };
  }
}
