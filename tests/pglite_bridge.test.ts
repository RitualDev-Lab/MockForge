import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { synthesizeMockData } from '../src/index.js';
import { createMockDatabase } from '../src/wasm/pglite-bridge.js';

describe('MockDatabaseBridge In-Browser WASM Engine Tests', () => {
  const sql = `
    CREATE TABLE tenants (
      id UUID PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      plan VARCHAR(50) NOT NULL
    );

    CREATE TABLE users (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      email VARCHAR(255) NOT NULL
    );
  `;

  test('Creates interactive mock database bridge and executes queries', async () => {
    const schema = SqlDdlParser.parse(sql, 'postgres');
    const dataset = synthesizeMockData(schema, {
      seed: 888,
      rowCounts: { tenants: 5, users: 15 }
    });

    const db = await createMockDatabase(schema, dataset);

    const tables = db.getTables();
    assert.equal(tables.length, 2);

    const tenantRes = await db.query('SELECT * FROM tenants');
    assert.equal(tenantRes.rowCount, 5);

    const countRes = await db.query('SELECT COUNT(*) FROM users');
    assert.equal(countRes.rows[0].count, 15);
  });
});
