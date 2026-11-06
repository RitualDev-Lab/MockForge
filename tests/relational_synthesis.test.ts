import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { RelationalSynthesisEngine } from '../src/generator/engine.js';
import { synthesizeMockData } from '../src/index.js';

describe('RelationalSynthesisEngine Multi-Table & Referential Integrity Tests', () => {
  const multiTableSql = `
    CREATE TABLE users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(120) NOT NULL UNIQUE
    );

    CREATE TABLE products (
      id UUID PRIMARY KEY,
      category_id INT NOT NULL REFERENCES categories(id),
      product_name VARCHAR(200) NOT NULL,
      sku VARCHAR(50) NOT NULL UNIQUE,
      unit_price NUMERIC(10, 2) NOT NULL
    );

    CREATE TABLE orders (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE order_items (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES orders(id),
      product_id UUID NOT NULL REFERENCES products(id),
      quantity INT NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      total_price NUMERIC(10, 2) NOT NULL
    );

    CREATE TABLE employees (
      id UUID PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      work_email VARCHAR(255) NOT NULL,
      manager_id UUID REFERENCES employees(id)
    );
  `;

  test('Synthesizes relational mock data across 6 connected tables with 100% referential integrity', () => {
    const schema = SqlDdlParser.parse(multiTableSql, 'postgres');

    const engine = new RelationalSynthesisEngine(schema, {
      seed: 1337,
      rowCounts: {
        users: 30,
        categories: 10,
        products: 50,
        orders: 100,
        order_items: 250,
        employees: 25
      }
    });

    const dataset = engine.generate();

    assert.equal(dataset.tables['users'].length, 30);
    assert.equal(dataset.tables['categories'].length, 10);
    assert.equal(dataset.tables['products'].length, 50);
    assert.equal(dataset.tables['orders'].length, 100);
    assert.equal(dataset.tables['order_items'].length, 250);
    assert.equal(dataset.tables['employees'].length, 25);
    assert.equal(dataset.totalRows, 465);

    // 1. Verify products -> categories referential integrity
    const categoryIds = new Set(dataset.tables['categories'].map((c) => c.id));
    for (const product of dataset.tables['products']) {
      assert.ok(
        categoryIds.has(product.category_id),
        `Product foreign key category_id (${product.category_id}) must exist in categories table`
      );
    }

    // 2. Verify orders -> users referential integrity
    const userIds = new Set(dataset.tables['users'].map((u) => u.id));
    for (const order of dataset.tables['orders']) {
      assert.ok(
        userIds.has(order.user_id),
        `Order foreign key user_id (${order.user_id}) must exist in users table`
      );
    }

    // 3. Verify order_items -> orders & products referential integrity
    const orderIds = new Set(dataset.tables['orders'].map((o) => o.id));
    const productIds = new Set(dataset.tables['products'].map((p) => p.id));
    for (const item of dataset.tables['order_items']) {
      assert.ok(
        orderIds.has(item.order_id),
        `OrderItem foreign key order_id (${item.order_id}) must exist in orders table`
      );
      assert.ok(
        productIds.has(item.product_id),
        `OrderItem foreign key product_id (${item.product_id}) must exist in products table`
      );
      // Arithmetic check
      const expectedTotal = Math.round(item.quantity * item.unit_price * 100) / 100;
      assert.equal(item.total_price, expectedTotal, 'total_price must equal quantity * unit_price');
    }

    // 4. Verify employees self-referencing tree hierarchy
    const employees = dataset.tables['employees'];
    assert.equal(employees[0].manager_id, null, 'Root executive (index 0) must have null manager_id');

    const employeeIds = new Set(employees.map((e) => e.id));
    for (let i = 1; i < employees.length; i++) {
      const emp = employees[i];
      if (emp.manager_id !== null) {
        assert.ok(
          employeeIds.has(emp.manager_id),
          `Employee manager_id (${emp.manager_id}) must exist in employees table`
        );
        // Ensure no self-direct-loop
        assert.notEqual(emp.manager_id, emp.id, 'Employee cannot be their own manager');
      }
    }
  });

  test('Guarantees 100% deterministic dataset generation given identical seed', () => {
    const schema = SqlDdlParser.parse(multiTableSql, 'postgres');

    const resultA = synthesizeMockData(schema, { seed: 9999, defaultRowCount: 20 });
    const resultB = synthesizeMockData(schema, { seed: 9999, defaultRowCount: 20 });

    assert.deepEqual(resultA.tables, resultB.tables, 'Runs with identical seeds must produce identical data');

    const resultC = synthesizeMockData(schema, { seed: 8888, defaultRowCount: 20 });
    assert.notDeepEqual(resultA.tables['users'], resultC.tables['users'], 'Different seeds must produce different data');
  });
});
