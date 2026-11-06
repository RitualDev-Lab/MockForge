import type { RelationalDataset } from '../generator/engine.js';
import type { ExportedFile } from './types.js';

export class CsvExporter {
  /**
   * Generates RFC 4180 compliant CSV files for every table in the dataset
   */
  static exportAll(dataset: RelationalDataset): ExportedFile[] {
    const files: ExportedFile[] = [];

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const csvContent = this.exportTable(rows);
      files.push({
        filename: `${tableName}.csv`,
        content: csvContent,
        mimeType: 'text/csv',
        sizeBytes: new TextEncoder().encode(csvContent).length
      });
    }

    return files;
  }

  /**
   * Serializes an array of records to RFC 4180 CSV
   */
  static exportTable(rows: Record<string, any>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines: string[] = [headers.map(this.escapeCsvCell).join(',')];

    for (const row of rows) {
      const cells = headers.map((h) => this.escapeCsvCell(row[h]));
      lines.push(cells.join(','));
    }

    return lines.join('\n');
  }

  private static escapeCsvCell(val: any): string {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
