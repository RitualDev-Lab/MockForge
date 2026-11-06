import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';

describe('SqlDdlParser Multi-Dialect Tests', () => {
  test('Parses PostgreSQL schema with UUID, ENUM, JSONB, and Check constraints', () => {
    const postgresSql = `
      -- Schema definition for E-Commerce
      CREATE TYPE order_status AS ENUM ('draft', 'processing', 'completed', 'cancelled');

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE orders (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status order_status NOT NULL DEFAULT 'draft',
        total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
        placed_at TIMESTAMPTZ
      );
    `;

    const schema = SqlDdlParser.parse(postgresSql);

    assert.equal(schema.dialect, 'postgres');
    assert.equal(schema.tables.length, 2);

    // Verify Enum
    assert.ok(schema.enums.order_status !== undefined);
    assert.deepEqual(schema.enums.order_status, ['draft', 'processing', 'completed', 'cancelled']);

    // Verify Users table
    const usersTable = schema.tables.find((t) => t.name === 'users');
    assert.ok(usersTable !== undefined);
    assert.deepEqual(usersTable?.primaryKey, ['id']);

    const idCol = usersTable?.columns.find((c) => c.name === 'id');
    assert.equal(idCol?.category, 'uuid');
    assert.equal(idCol?.isPrimaryKey, true);

    const emailCol = usersTable?.columns.find((c) => c.name === 'email');
    assert.equal(emailCol?.category, 'textual');
    assert.equal(emailCol?.isNullable, false);
    assert.equal(emailCol?.isUnique, true);

    // Verify Orders table
    const ordersTable = schema.tables.find((t) => t.name === 'orders');
    assert.ok(ordersTable !== undefined);
    assert.equal(ordersTable?.foreignKeys.length, 1);

    const fk = ordersTable?.foreignKeys[0];
    assert.equal(fk?.sourceColumn, 'user_id');
    assert.equal(fk?.targetTable, 'users');
    assert.equal(fk?.targetColumn, 'id');
    assert.equal(fk?.onDelete, 'CASCADE');

    const totalCol = ordersTable?.columns.find((c) => c.name === 'total_amount');
    assert.equal(totalCol?.category, 'numeric');
    assert.equal(totalCol?.precision, 10);
    assert.equal(totalCol?.scale, 2);
    assert.ok(totalCol?.checkConstraint?.includes('total_amount >= 0'));
  });

  test('Parses MySQL schema with backticks, AUTO_INCREMENT, and composite primary key', () => {
    const mysqlSql = `
      CREATE TABLE \`tenants\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`subdomain\` VARCHAR(64) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_subdomain\` (\`subdomain\`)
      ) ENGINE=InnoDB;

      CREATE TABLE \`tenant_members\` (
        \`tenant_id\` INT NOT NULL,
        \`user_id\` VARCHAR(36) NOT NULL,
        \`role\` ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
        PRIMARY KEY (\`tenant_id\`, \`user_id\`),
        CONSTRAINT \`fk_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `;

    const schema = SqlDdlParser.parse(mysqlSql);

    assert.equal(schema.dialect, 'mysql');
    assert.equal(schema.tables.length, 2);

    const tenants = schema.tables.find((t) => t.name === 'tenants');
    assert.ok(tenants !== undefined);
    assert.deepEqual(tenants?.primaryKey, ['id']);
    const idCol = tenants?.columns.find((c) => c.name === 'id');
    assert.equal(idCol?.isAutoIncrement, true);

    const members = schema.tables.find((t) => t.name === 'tenant_members');
    assert.ok(members !== undefined);
    // Composite Primary Key
    assert.deepEqual(members?.primaryKey, ['tenant_id', 'user_id']);

    // Enum
    const roleCol = members?.columns.find((c) => c.name === 'role');
    assert.equal(roleCol?.category, 'enum');
    assert.deepEqual(roleCol?.enumValues, ['owner', 'admin', 'member']);
  });

  test('Parses ALTER TABLE ADD CONSTRAINT foreign keys', () => {
    const sql = `
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL
      );

      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        category_id INT NOT NULL,
        name VARCHAR(200) NOT NULL
      );

      ALTER TABLE products ADD CONSTRAINT fk_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
    `;

    const schema = SqlDdlParser.parse(sql);
    const products = schema.tables.find((t) => t.name === 'products');
    assert.ok(products !== undefined);
    assert.equal(products?.foreignKeys.length, 1);
    assert.equal(products?.foreignKeys[0].targetTable, 'categories');
    assert.equal(products?.foreignKeys[0].onDelete, 'SET NULL');
  });

  test('Parses SQLite schema syntax with AUTOINCREMENT', () => {
    const sqliteSql = `
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        qty INTEGER DEFAULT 0
      );
    `;

    const schema = SqlDdlParser.parse(sqliteSql);
    assert.equal(schema.dialect, 'sqlite');
    assert.equal(schema.tables.length, 1);
    const item = schema.tables[0];
    assert.deepEqual(item.primaryKey, ['id']);
    assert.equal(item.columns[0].isAutoIncrement, true);
  });
});
