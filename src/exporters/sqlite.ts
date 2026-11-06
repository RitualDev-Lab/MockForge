import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import type { ExportOptions, ExportedFile } from './types.js';
import { SqlUtils } from './sql-utils.js';

export class SqliteExporter {
  static export(
    dataset: RelationalDataset,
    _schema: DatabaseSchema,
    options: ExportOptions = { format: 'sqlite' }
  ): ExportedFile {
    const lines: string[] = [];
    const batchSize = options.batchSize ?? 500;

    lines.push('-- MockForge AI: SQLite Relational Seed Script');
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Total Rows: ${dataset.totalRows} | Seed: ${dataset.seed}\n`);

    if (options.disableForeignKeyChecks !== false) {
      lines.push('PRAGMA foreign_keys = OFF;\n');
    }

    if (options.includeTransactions !== false) {
      lines.push('BEGIN TRANSACTION;\n');
    }

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map((c) => SqlUtils.quoteIdentifier(c, 'sqlite')).join(', ');
      const quotedTable = SqlUtils.quoteIdentifier(tableName, 'sqlite');

      lines.push(`-- Table: ${tableName} (${rows.length} rows)`);

      const chunks = SqlUtils.chunk(rows, batchSize);
      for (const chunk of chunks) {
        const valuesList = chunk.map((row) => {
          const rowValues = columns.map((c) => SqlUtils.formatValue(row[c], 'sqlite')).join(', ');
          return `  (${rowValues})`;
        });

        lines.push(`INSERT INTO ${quotedTable} (${quotedCols}) VALUES\n${valuesList.join(',\n')};\n`);
      }
    }

    if (options.includeTransactions !== false) {
      lines.push('COMMIT;\n');
    }

    if (options.disableForeignKeyChecks !== false) {
      lines.push('PRAGMA foreign_keys = ON;\n');
    }

    const content = lines.join('\n');
    return {
      filename: 'seed_sqlite.sql',
      content,
      mimeType: 'application/sql',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }
}
