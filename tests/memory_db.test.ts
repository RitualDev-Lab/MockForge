import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { synthesizeMockData } from '../src/index.js';
import { InMemoryMockDatabase } from '../src/wasm/memory-db.js';

describe('InMemoryMockDatabase Relational SQL Query Engine Tests', () => {
  const sql = `
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      role VARCHAR(50) NOT NULL
    );

    CREATE TABLE products (
      id UUID PRIMARY KEY,
      product_name VARCHAR(150) NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      stock INT NOT NULL
    );

    CREATE TABLE orders (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      status VARCHAR(50) NOT NULL
    );
  `;

  const schema = SqlDdlParser.parse(sql, 'postgres');
  const dataset = synthesizeMockData(schema, {
    seed: 1234,
    rowCounts: { users: 20, products: 15, orders: 30 }
  });

  const db = new InMemoryMockDatabase(schema, dataset);

  test('Loads dataset and returns correct table metadata', () => {
    const tables = db.getTables();
    assert.equal(tables.length, 3);

    const userTable = tables.find((t) => t.name === 'users');
    assert.ok(userTable);
    assert.equal(userTable.rowCount, 20);
    assert.deepEqual(userTable.columns, ['id', 'email', 'full_name', 'role']);
  });

  test('Executes SELECT * and column projection queries', () => {
    const resAll = db.query('SELECT * FROM users;');
    assert.equal(resAll.rowCount, 20);
    assert.equal(resAll.rows.length, 20);

    const resProj = db.query('SELECT email, full_name FROM users;');
    assert.equal(resProj.rowCount, 20);
    assert.deepEqual(resProj.columns, ['email', 'full_name']);
    assert.ok(resProj.rows[0].email);
    assert.equal(resProj.rows[0].id, undefined);
  });

  test('Executes WHERE condition filtering (=, >=, AND)', () => {
    // 1. String match
    const firstUser = db.getTableRows('users')[0];
    const resMatch = db.query(`SELECT * FROM users WHERE id = '${firstUser.id}'`);
    assert.equal(resMatch.rowCount, 1);
    assert.equal(resMatch.rows[0].id, firstUser.id);

    // 2. Numeric range filter
    const resPrice = db.query('SELECT * FROM products WHERE unit_price >= 20.00');
    assert.ok(resPrice.rowCount > 0);
    for (const r of resPrice.rows) {
      assert.ok(Number(r.unit_price) >= 20.0);
    }
  });

  test('Executes relational JOIN queries between parent and child tables', () => {
    const resJoin = db.query('SELECT orders.id, orders.user_id, users.email FROM orders JOIN users ON orders.user_id = users.id');
    assert.equal(resJoin.rowCount, 30);
    for (const r of resJoin.rows) {
      assert.ok(r.user_id, 'Joined row must contain foreign key user_id');
      assert.ok(r.email, 'Joined row must contain joined parent email');
    }
  });

  test('Executes SQL aggregate functions: COUNT, SUM, AVG', () => {
    const resAgg = db.query('SELECT COUNT(*), SUM(unit_price), AVG(unit_price) FROM products');
    assert.equal(resAgg.rowCount, 1);
    const agg = resAgg.rows[0];

    assert.equal(agg.count, 15);
    assert.ok(agg.sum > 0);
    assert.ok(agg.avg > 0);
    assert.equal(Math.round((agg.sum / 15) * 100), Math.round(agg.avg * 100));
  });

  test('Executes ORDER BY, LIMIT, and OFFSET pagination', () => {
    const resPage = db.query('SELECT * FROM products ORDER BY unit_price DESC LIMIT 5 OFFSET 2');
    assert.equal(resPage.rowCount, 5);

    // Verify descending sort order
    for (let i = 0; i < resPage.rows.length - 1; i++) {
      const p1 = Number(resPage.rows[i].unit_price);
      const p2 = Number(resPage.rows[i + 1].unit_price);
      assert.ok(p1 >= p2, `Row ${i} price (${p1}) must be >= Row ${i + 1} price (${p2})`);
    }
  });

  test('Executes INSERT and DELETE operations in-memory', () => {
    const insertRes = db.query("INSERT INTO users (id, email, full_name, role) VALUES ('test-uuid-999', 'admin@mockforge.dev', 'Root Admin', 'admin')");
    assert.equal(insertRes.rows[0].status, 'success');

    const checkRes = db.query("SELECT * FROM users WHERE id = 'test-uuid-999'");
    assert.equal(checkRes.rowCount, 1);
    assert.equal(checkRes.rows[0].email, 'admin@mockforge.dev');

    const delRes = db.query("DELETE FROM users WHERE id = 'test-uuid-999'");
    assert.equal(delRes.rows[0].deleted_count, 1);

    const checkAfter = db.query("SELECT * FROM users WHERE id = 'test-uuid-999'");
    assert.equal(checkAfter.rowCount, 0);
  });
});
