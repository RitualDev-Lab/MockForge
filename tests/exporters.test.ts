import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { synthesizeMockData } from '../src/index.js';
import {
  exportDataset,
  PostgresExporter,
  MySqlExporter,
  SqliteExporter,
  OrmExporter,
  CsvExporter,
  JsonExporter
} from '../src/exporters/index.js';

describe('Multi-Format Relational Exporters Tests', () => {
  const schemaSql = `
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      is_active BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      total_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL
    );
  `;

  const schema = SqlDdlParser.parse(schemaSql, 'postgres');
  const dataset = synthesizeMockData(schema, {
    seed: 42,
    rowCounts: { users: 10, orders: 20 }
  });

  test('PostgresExporter produces transactional INSERT script with sequence resets', () => {
    const file = PostgresExporter.exportInsert(dataset, schema);

    assert.equal(file.filename, 'seed_postgres.sql');
    assert.equal(file.mimeType, 'application/sql');
    assert.ok(file.content.includes('BEGIN;'));
    assert.ok(file.content.includes("SET session_replication_role = 'replica';"));
    assert.ok(file.content.includes('INSERT INTO "users"'));
    assert.ok(file.content.includes('INSERT INTO "orders"'));
    assert.ok(file.content.includes("SELECT setval(pg_get_serial_sequence('orders', 'id')"));
    assert.ok(file.content.includes("SET session_replication_role = 'origin';"));
    assert.ok(file.content.includes('COMMIT;'));
  });

  test('PostgresExporter produces high-speed COPY FROM stdin streaming script', () => {
    const file = PostgresExporter.exportCopy(dataset, schema);

    assert.equal(file.filename, 'seed_postgres_copy.sql');
    assert.ok(file.content.includes('COPY "users"'));
    assert.ok(file.content.includes('COPY "orders"'));
    assert.ok(file.content.includes('\\.'));
    assert.ok(file.content.includes('COMMIT;'));
  });

  test('MySqlExporter produces valid MySQL dump with backticks and FK checks', () => {
    const file = MySqlExporter.export(dataset, schema);

    assert.equal(file.filename, 'seed_mysql.sql');
    assert.ok(file.content.includes('SET FOREIGN_KEY_CHECKS = 0;'));
    assert.ok(file.content.includes('START TRANSACTION;'));
    assert.ok(file.content.includes('INSERT INTO `users`'));
    assert.ok(file.content.includes('INSERT INTO `orders`'));
    assert.ok(file.content.includes('SET FOREIGN_KEY_CHECKS = 1;'));
    assert.ok(file.content.includes('COMMIT;'));
  });

  test('SqliteExporter produces PRAGMA foreign keys disabled script', () => {
    const file = SqliteExporter.export(dataset, schema);

    assert.equal(file.filename, 'seed_sqlite.sql');
    assert.ok(file.content.includes('PRAGMA foreign_keys = OFF;'));
    assert.ok(file.content.includes('BEGIN TRANSACTION;'));
    assert.ok(file.content.includes('INSERT INTO "users"'));
    assert.ok(file.content.includes('PRAGMA foreign_keys = ON;'));
    assert.ok(file.content.includes('COMMIT;'));
  });

  test('OrmExporter produces turnkey Prisma and Drizzle seed scripts', () => {
    const prismaFile = OrmExporter.exportPrisma(dataset, schema);
    assert.equal(prismaFile.filename, 'seed.ts');
    assert.ok(prismaFile.content.includes("import { PrismaClient } from '@prisma/client'"));
    assert.ok(prismaFile.content.includes('await (prisma as any).users.createMany'));
    assert.ok(prismaFile.content.includes('await prisma.$disconnect()'));

    const drizzleFile = OrmExporter.exportDrizzle(dataset, schema);
    assert.equal(drizzleFile.filename, 'seed_drizzle.ts');
    assert.ok(drizzleFile.content.includes('export async function seed(db: any)'));
    assert.ok(drizzleFile.content.includes('await db.insert'));
  });

  test('CsvExporter produces RFC 4180 CSV files per table', () => {
    const files = CsvExporter.exportAll(dataset);

    assert.equal(files.length, 2);
    const usersCsv = files.find((f) => f.filename === 'users.csv');
    assert.ok(usersCsv);
    assert.ok(usersCsv.content.startsWith('id,email,full_name,is_active,created_at'));

    // 10 data rows + 1 header line = 11 lines
    const lines = usersCsv.content.split('\n');
    assert.equal(lines.length, 11);
  });

  test('JsonExporter produces unified relational JSON bundle', () => {
    const bundleFile = JsonExporter.exportBundle(dataset);
    assert.equal(bundleFile.filename, 'relational_dataset.json');

    const parsed = JSON.parse(bundleFile.content);
    assert.equal(parsed.metadata.totalRows, 30);
    assert.equal(parsed.tables.users.length, 10);
    assert.equal(parsed.tables.orders.length, 20);
  });

  test('Universal exportDataset facade dispatches all formats properly', () => {
    const postgresBundle = exportDataset(dataset, schema, { format: 'postgres' });
    assert.equal(postgresBundle.format, 'postgres');
    assert.ok(postgresBundle.totalBytes > 0);
    assert.equal(postgresBundle.primaryFile.filename, 'seed_postgres.sql');

    const csvBundle = exportDataset(dataset, schema, { format: 'csv' });
    assert.equal(csvBundle.format, 'csv');
    assert.equal(csvBundle.files.length, 2);
  });
});
