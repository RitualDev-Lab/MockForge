import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { DependencyGraph } from '../src/graph/dag.js';

describe('Topological Dependency DAG & Kahn Algorithm Tests', () => {
  test('Orders multi-table e-commerce schema in correct parent-child execution sequence', () => {
    const sql = `
      CREATE TABLE order_items (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders(id),
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        category_id INT REFERENCES categories(id),
        title TEXT NOT NULL
      );

      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id),
        order_date TIMESTAMP NOT NULL
      );

      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE customers (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL
      );
    `;

    const schema = SqlDdlParser.parse(sql);
    const graph = new DependencyGraph(schema);
    const result = graph.resolveExecutionOrder();

    assert.equal(result.hasCycles, false);
    assert.equal(result.executionOrder.length, 5);

    const order = result.executionOrder.map((t) => t.toLowerCase());

    // categories must come before products
    assert.ok(order.indexOf('categories') < order.indexOf('products'));

    // customers must come before orders
    assert.ok(order.indexOf('customers') < order.indexOf('orders'));

    // orders and products must both come before order_items
    assert.ok(order.indexOf('orders') < order.indexOf('order_items'));
    assert.ok(order.indexOf('products') < order.indexOf('order_items'));
  });

  test('Handles self-referencing foreign keys without deadlock', () => {
    const sql = `
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        manager_id INT REFERENCES employees(id)
      );

      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        lead_id INT REFERENCES employees(id)
      );
    `;

    const schema = SqlDdlParser.parse(sql);
    const graph = new DependencyGraph(schema);
    const result = graph.resolveExecutionOrder();

    assert.equal(result.hasCycles, false);
    assert.equal(result.executionOrder.length, 2);

    const order = result.executionOrder.map((t) => t.toLowerCase());
    assert.ok(order.indexOf('employees') < order.indexOf('departments'));

    // Self-reference manager_id should be deferred for 2nd pass
    const empStep = result.steps.find((s) => s.tableName.toLowerCase() === 'employees');
    assert.ok(empStep !== undefined);
    assert.equal(empStep?.deferredForeignKeys.length, 1);
    assert.equal(empStep?.deferredForeignKeys[0].sourceColumn, 'manager_id');
  });

  test('Detects and breaks circular foreign key dependencies cleanly', () => {
    const sql = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        active_account_id INT -- references accounts(id)
      );

      CREATE TABLE accounts (
        id SERIAL PRIMARY KEY,
        owner_id INT NOT NULL REFERENCES users(id),
        balance NUMERIC(10, 2)
      );

      ALTER TABLE users ADD CONSTRAINT fk_user_account FOREIGN KEY (active_account_id) REFERENCES accounts(id);
    `;

    const schema = SqlDdlParser.parse(sql);
    const graph = new DependencyGraph(schema);
    const result = graph.resolveExecutionOrder();

    // The circular cycle users <-> accounts is broken by deferring the nullable active_account_id FK
    assert.equal(result.executionOrder.length, 2);

    const usersStep = result.steps.find((s) => s.tableName.toLowerCase() === 'users');
    assert.ok(usersStep !== undefined);
    assert.equal(usersStep?.deferredForeignKeys.length, 1);
    assert.equal(usersStep?.deferredForeignKeys[0].sourceColumn, 'active_account_id');
  });
});
