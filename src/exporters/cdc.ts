import type { RelationalDataset } from '../generator/engine.js';
import type { ExportBundle, ExportOptions, ExportedFile } from './types.js';

export interface DebeziumCdcEnvelope {
  schema: {
    type: 'struct';
    fields: Array<{ type: string; optional: boolean; field: string }>;
    name: string;
  };
  payload: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    source: {
      version: string;
      connector: string;
      db: string;
      table: string;
      ts_ms: number;
    };
    op: 'c' | 'u' | 'd';
    ts_ms: number;
  };
}

export class CdcExporter {
  public static export(dataset: RelationalDataset, options?: Partial<ExportOptions>): ExportBundle {
    const files: ExportedFile[] = [];
    let totalBytes = 0;
    const now = Date.now();

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName] || [];
      const lines: string[] = [];

      for (const row of rows) {
        const envelope: DebeziumCdcEnvelope = {
          schema: {
            type: 'struct',
            name: `io.debezium.connector.postgresql.${tableName}.Envelope`,
            fields: Object.keys(row).map((k) => ({
              type: typeof row[k] === 'number' ? 'int64' : 'string',
              optional: true,
              field: k,
            })),
          },
          payload: {
            before: null,
            after: row,
            source: {
              version: '2.5.0.Final',
              connector: 'postgresql',
              db: 'mockforge_enterprise',
              table: tableName,
              ts_ms: now,
            },
            op: 'c', // create / insert
            ts_ms: now,
          },
        };

        lines.push(JSON.stringify(envelope));
      }

      const content = lines.join('\n');
      const sizeBytes = Buffer.byteLength(content, 'utf8');
      totalBytes += sizeBytes;

      files.push({
        filename: `${tableName}.debezium.jsonl`,
        content,
        mimeType: 'application/x-ndjson',
        sizeBytes,
      });
    }

    return {
      format: (options?.format as any) || 'debezium-cdc',
      files,
      totalBytes,
      primaryFile: files[0] || {
        filename: 'empty.cdc.jsonl',
        content: '',
        mimeType: 'application/x-ndjson',
        sizeBytes: 0,
      },
    };
  }
}
