import type { RelationalDataset } from '../generator/engine.js';
import type { ExportedFile } from './types.js';

export class JsonExporter {
  /**
   * Generates a unified relational JSON bundle containing all tables
   */
  static exportBundle(dataset: RelationalDataset): ExportedFile {
    const payload = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalRows: dataset.totalRows,
        seed: dataset.seed,
        executionOrder: dataset.executionOrder
      },
      tables: dataset.tables
    };

    const content = JSON.stringify(payload, null, 2);
    return {
      filename: 'relational_dataset.json',
      content,
      mimeType: 'application/json',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }

  /**
   * Generates individual JSON files per table
   */
  static exportIndividual(dataset: RelationalDataset): ExportedFile[] {
    const files: ExportedFile[] = [];

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName] || [];
      const content = JSON.stringify(rows, null, 2);
      files.push({
        filename: `${tableName}.json`,
        content,
        mimeType: 'application/json',
        sizeBytes: new TextEncoder().encode(content).length
      });
    }

    return files;
  }
}
