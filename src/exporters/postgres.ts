import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import type { ExportOptions, ExportedFile } from './types.js';
import { SqlUtils } from './sql-utils.js';

export class PostgresExporter {
  /**
   * Generates production-ready PostgreSQL SQL seed script with batch INSERTs
   */
  static exportInsert(
    dataset: RelationalDataset,
    schema: DatabaseSchema,
    options: ExportOptions = { format: 'postgres' }
  ): ExportedFile {
    const lines: string[] = [];
    const batchSize = options.batchSize ?? 500;

    lines.push('-- MockForge AI: PostgreSQL Relational Seed Script');
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Total Rows: ${dataset.totalRows} | Seed: ${dataset.seed}\n`);

    if (options.includeTransactions !== false) {
      lines.push('BEGIN;\n');
    }

    if (options.disableForeignKeyChecks !== false) {
      lines.push('-- Temporarily disable foreign key constraints and triggers for high-speed import');
      lines.push("SET session_replication_role = 'replica';\n");
    }

    // Process tables in topological execution order
    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map((c) => SqlUtils.quoteIdentifier(c, 'postgres')).join(', ');
      const quotedTable = SqlUtils.quoteIdentifier(tableName, 'postgres');

      lines.push(`-- Table: ${tableName} (${rows.length} rows)`);

      const chunks = SqlUtils.chunk(rows, batchSize);
      for (const chunk of chunks) {
        const valuesList = chunk.map((row) => {
          const rowValues = columns.map((c) => SqlUtils.formatValue(row[c], 'postgres')).join(', ');
          return `  (${rowValues})`;
        });

        lines.push(`INSERT INTO ${quotedTable} (${quotedCols}) VALUES\n${valuesList.join(',\n')};\n`);
      }

      // Reset sequence for SERIAL/BIGSERIAL columns
      const tableDef = schema.tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
      const serialCol = tableDef?.columns.find(
        (c) => c.isAutoIncrement || c.normalizedType === 'serial' || c.normalizedType === 'bigserial'
      );
      if (serialCol) {
        lines.push(
          `SELECT setval(pg_get_serial_sequence('${tableName}', '${serialCol.name}'), coalesce(max(${SqlUtils.quoteIdentifier(serialCol.name, 'postgres')}), 1)) FROM ${quotedTable};\n`
        );
      }
    }

    if (options.disableForeignKeyChecks !== false) {
      lines.push('-- Re-enable foreign key constraints and triggers');
      lines.push("SET session_replication_role = 'origin';\n");
    }

    if (options.includeTransactions !== false) {
      lines.push('COMMIT;\n');
    }

    const content = lines.join('\n');
    return {
      filename: 'seed_postgres.sql',
      content,
      mimeType: 'application/sql',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }

  /**
   * Generates high-speed PostgreSQL COPY ... FROM stdin streaming script
   */
  static exportCopy(
    dataset: RelationalDataset,
    schema: DatabaseSchema,
    options: ExportOptions = { format: 'postgres-copy' }
  ): ExportedFile {
    const lines: string[] = [];

    lines.push('-- MockForge AI: PostgreSQL High-Speed COPY Seed Script');
    lines.push(`-- Generated: ${new Date().toISOString()}`);
    lines.push(`-- Total Rows: ${dataset.totalRows} | Seed: ${dataset.seed}\n`);

    if (options.includeTransactions !== false) {
      lines.push('BEGIN;\n');
    }

    if (options.disableForeignKeyChecks !== false) {
      lines.push("SET session_replication_role = 'replica';\n");
    }

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map((c) => SqlUtils.quoteIdentifier(c, 'postgres')).join(', ');
      const quotedTable = SqlUtils.quoteIdentifier(tableName, 'postgres');

      lines.push(`COPY ${quotedTable} (${quotedCols}) FROM stdin;`);

      for (const row of rows) {
        const rowTokens = columns.map((c) => {
          const val = row[c];
          if (val === null || val === undefined) return '\\N';
          if (typeof val === 'boolean') return val ? 't' : 'f';
          if (typeof val === 'object') return JSON.stringify(val).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
          return String(val).replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
        });
        lines.push(rowTokens.join('\t'));
      }

      lines.push('\\.\n');

      const tableDef = schema.tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());
      const serialCol = tableDef?.columns.find(
        (c) => c.isAutoIncrement || c.normalizedType === 'serial' || c.normalizedType === 'bigserial'
      );
      if (serialCol) {
        lines.push(
          `SELECT setval(pg_get_serial_sequence('${tableName}', '${serialCol.name}'), coalesce(max(${SqlUtils.quoteIdentifier(serialCol.name, 'postgres')}), 1)) FROM ${quotedTable};\n`
        );
      }
    }

    if (options.disableForeignKeyChecks !== false) {
      lines.push("SET session_replication_role = 'origin';\n");
    }

    if (options.includeTransactions !== false) {
      lines.push('COMMIT;\n');
    }

    const content = lines.join('\n');
    return {
      filename: 'seed_postgres_copy.sql',
      content,
      mimeType: 'application/sql',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }
}
