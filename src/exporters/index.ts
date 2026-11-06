import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import type { ExportOptions, ExportBundle, ExportedFile } from './types.js';
import { PostgresExporter } from './postgres.js';
import { MySqlExporter } from './mysql.js';
import { SqliteExporter } from './sqlite.js';
import { OrmExporter } from './orm.js';
import { CsvExporter } from './csv.js';
import { JsonExporter } from './json.js';

export * from './types.js';
export { SqlUtils } from './sql-utils.js';
export { PostgresExporter } from './postgres.js';
export { MySqlExporter } from './mysql.js';
export { SqliteExporter } from './sqlite.js';
export { OrmExporter } from './orm.js';
export { CsvExporter } from './csv.js';
export { JsonExporter } from './json.js';

/**
 * Universal exporter that transforms a relational dataset into the target database script or ORM file bundle
 */
export function exportDataset(
  dataset: RelationalDataset,
  schema: DatabaseSchema,
  options: ExportOptions
): ExportBundle {
  let files: ExportedFile[] = [];

  switch (options.format) {
    case 'postgres':
      files = [PostgresExporter.exportInsert(dataset, schema, options)];
      break;

    case 'postgres-copy':
      files = [PostgresExporter.exportCopy(dataset, schema, options)];
      break;

    case 'mysql':
      files = [MySqlExporter.export(dataset, schema, options)];
      break;

    case 'sqlite':
      files = [SqliteExporter.export(dataset, schema, options)];
      break;

    case 'prisma':
      files = [OrmExporter.exportPrisma(dataset, schema)];
      break;

    case 'drizzle':
      files = [OrmExporter.exportDrizzle(dataset, schema)];
      break;

    case 'csv':
      files = CsvExporter.exportAll(dataset);
      break;

    case 'json':
      files = [JsonExporter.exportBundle(dataset), ...JsonExporter.exportIndividual(dataset)];
      break;

    default:
      files = [PostgresExporter.exportInsert(dataset, schema, options)];
      break;
  }

  const totalBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  const primaryFile = files[0];

  return {
    format: options.format,
    files,
    totalBytes,
    primaryFile
  };
}
