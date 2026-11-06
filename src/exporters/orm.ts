import type { DatabaseSchema } from '../types/schema.js';
import type { RelationalDataset } from '../generator/engine.js';
import type { ExportedFile } from './types.js';

export class OrmExporter {
  /**
   * Generates a turnkey TypeScript seed script for Prisma ORM (prisma/seed.ts)
   */
  static exportPrisma(dataset: RelationalDataset, _schema: DatabaseSchema): ExportedFile {
    const lines: string[] = [];

    lines.push('// MockForge AI: Turnkey Prisma Seed Script (prisma/seed.ts)');
    lines.push(`// Generated: ${new Date().toISOString()}`);
    lines.push(`// Total Rows: ${dataset.totalRows} | Seed: ${dataset.seed}\n`);
    lines.push("import { PrismaClient } from '@prisma/client';\n");
    lines.push('const prisma = new PrismaClient();\n');
    lines.push('async function main() {');
    lines.push("  console.log('Seeding relational database via MockForge AI...');\n");

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const modelAccessor = this.toCamelCase(tableName);
      lines.push(`  // Seed table: ${tableName} (${rows.length} records)`);
      lines.push(`  const ${modelAccessor}Data = ${JSON.stringify(rows, null, 2)};\n`);
      lines.push(`  await (prisma as any).${modelAccessor}.createMany({`);
      lines.push(`    data: ${modelAccessor}Data,`);
      lines.push('    skipDuplicates: true,');
      lines.push('  });');
      lines.push(`  console.log('  ✓ Seeded ${rows.length} rows into ${tableName}');\n`);
    }

    lines.push("  console.log('✓ MockForge AI seeding completed successfully.');");
    lines.push('}\n');
    lines.push('main()');
    lines.push('  .catch((e) => {');
    lines.push('    console.error(e);');
    lines.push('    process.exit(1);');
    lines.push('  })');
    lines.push('  .finally(async () => {');
    lines.push('    await prisma.$disconnect();');
    lines.push('  });\n');

    const content = lines.join('\n');
    return {
      filename: 'seed.ts',
      content,
      mimeType: 'text/typescript',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }

  /**
   * Generates a turnkey TypeScript seed script for Drizzle ORM (drizzle/seed.ts)
   */
  static exportDrizzle(dataset: RelationalDataset, _schema: DatabaseSchema): ExportedFile {
    const lines: string[] = [];

    lines.push('// MockForge AI: Turnkey Drizzle ORM Seed Script (drizzle/seed.ts)');
    lines.push(`// Generated: ${new Date().toISOString()}`);
    lines.push(`// Total Rows: ${dataset.totalRows} | Seed: ${dataset.seed}\n`);
    lines.push("import * as schema from './schema';\n");
    lines.push('export async function seed(db: any) {');
    lines.push("  console.log('Seeding database via Drizzle ORM...');\n");

    for (const tableName of dataset.executionOrder) {
      const rows = dataset.tables[tableName];
      if (!rows || rows.length === 0) continue;

      const tableVar = this.toCamelCase(tableName);
      lines.push(`  // Table: ${tableName} (${rows.length} records)`);
      lines.push(`  const ${tableVar}Data = ${JSON.stringify(rows, null, 2)};\n`);
      lines.push(`  if ((schema as any).${tableVar}) {`);
      lines.push(`    await db.insert((schema as any).${tableVar}).values(${tableVar}Data);`);
      lines.push(`    console.log('  ✓ Inserted ${rows.length} records into ${tableName}');`);
      lines.push('  }\n');
    }

    lines.push("  console.log('✓ Drizzle seeding completed.');");
    lines.push('}\n');

    const content = lines.join('\n');
    return {
      filename: 'seed_drizzle.ts',
      content,
      mimeType: 'text/typescript',
      sizeBytes: new TextEncoder().encode(content).length
    };
  }

  /**
   * Converts snake_case or plural table name to camelCase singular/model name
   */
  private static toCamelCase(str: string): string {
    const cleaned = str.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }
}
