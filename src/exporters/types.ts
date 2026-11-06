export type ExportFormat =
  | 'postgres'
  | 'postgres-copy'
  | 'mysql'
  | 'sqlite'
  | 'prisma'
  | 'drizzle'
  | 'csv'
  | 'json';

export interface ExportOptions {
  format: ExportFormat;
  batchSize?: number; // Chunk size for multi-row INSERTs (default: 500)
  includeSchema?: boolean; // Include CREATE TABLE DDL (default: false)
  includeDropTable?: boolean; // Include DROP TABLE IF EXISTS (default: false)
  includeTransactions?: boolean; // Wrap in BEGIN/COMMIT (default: true)
  disableForeignKeyChecks?: boolean; // Toggle FK checks during import (default: true)
}

export interface ExportedFile {
  filename: string;
  content: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ExportBundle {
  format: ExportFormat;
  files: ExportedFile[];
  totalBytes: number;
  primaryFile: ExportedFile;
}
