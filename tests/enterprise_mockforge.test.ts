import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DatabaseMasker } from '../src/anonymizer/database-masker.js';
import { EphemeralMockServer } from '../src/server/mock-server.js';
import { OrmMigrationSynchronizer } from '../src/orm/synchronizer.js';
import type { DatabaseSchema } from '../src/types/schema.js';

import { SqlDdlParser } from '../src/parser/sql-parser.js';

describe('Enterprise MockForge AI Upgrades Suite', () => {
  const sampleSchema = SqlDdlParser.parse(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      phone VARCHAR(50),
      ssn VARCHAR(20)
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      amount NUMERIC(10, 2) NOT NULL,
      credit_card VARCHAR(30) NOT NULL
    );
  `);

  const sampleRawDataset = {
    users: [
      { id: 101, email: 'john.doe@realcorp.com', full_name: 'Johnathan Doe', phone: '+1-555-0199', ssn: '999-12-3456' },
      { id: 102, email: 'jane.smith@realcorp.com', full_name: 'Jane Smith', phone: '+1-555-0288', ssn: '888-23-4567' }
    ],
    orders: [
      { id: 5001, user_id: 101, amount: 249.99, credit_card: '4532015012345671' },
      { id: 5002, user_id: 101, amount: 79.50, credit_card: '4532015012345671' },
      { id: 5003, user_id: 102, amount: 1200.00, credit_card: '378282246310005' }
    ]
  };

  describe('DatabaseMasker (Production SQL & Dataset Anonymization)', () => {
    it('Anonymizes PII fields while preserving primary and foreign keys', () => {
      const masker = new DatabaseMasker({ seed: 777 });
      const result = masker.maskDataset(sampleRawDataset);

      // Verify PKs preserved
      assert.strictEqual(result.data.users[0].id, 101);
      assert.strictEqual(result.data.users[1].id, 102);

      // Verify FKs preserved
      assert.strictEqual(result.data.orders[0].user_id, 101);
      assert.strictEqual(result.data.orders[1].user_id, 101);
      assert.strictEqual(result.data.orders[2].user_id, 102);

      // Verify PII masked
      assert.notStrictEqual(result.data.users[0].email, 'john.doe@realcorp.com');
      assert.ok(result.data.users[0].email.includes('@'));
      assert.notStrictEqual(result.data.users[0].full_name, 'Johnathan Doe');
      assert.notStrictEqual(result.data.users[0].ssn, '999-12-3456');
      assert.notStrictEqual(result.data.orders[0].credit_card, '4532015012345671');

      // Verify compliance audit report
      assert.strictEqual(result.auditReport.tablesProcessed, 2);
      assert.strictEqual(result.auditReport.rowsProcessed, 5);
      assert.strictEqual(result.auditReport.compliance.hipaaCompliant, true);
      assert.strictEqual(result.auditReport.compliance.gdprCompliant, true);
      assert.strictEqual(result.auditReport.compliance.pciDssCompliant, true);
    });

    it('Masks raw SQL INSERT statements directly from dump files', () => {
      const sqlDump = `
        INSERT INTO "users" ("id", "email", "full_name") VALUES
          (1, 'ceo@megaenterprisegroup.com', 'Alexander Pierce'),
          (2, 'cto@megaenterprisegroup.com', 'Natasha Romanoff');
      `;

      const masker = new DatabaseMasker({ seed: 123 });
      const { maskedSql, auditReport } = masker.maskSqlDump(sqlDump);

      assert.ok(!maskedSql.includes('ceo@megaenterprisegroup.com'));
      assert.ok(!maskedSql.includes('Alexander Pierce'));
      assert.ok(maskedSql.includes('INSERT INTO "users"'));
      assert.strictEqual(auditReport.rowsProcessed, 2);
      assert.strictEqual(auditReport.tablesProcessed, 1);
    });

    it('Applies deterministic pseudonymization given consistent salt and context', () => {
      const masker1 = new DatabaseMasker({ seed: 42, salt: 'prod-salt-secret' });
      const masker2 = new DatabaseMasker({ seed: 42, salt: 'prod-salt-secret' });

      const email1 = masker1.applyMasking('user123@domain.com', 'email', 'users.email');
      const email2 = masker2.applyMasking('user123@domain.com', 'email', 'users.email');

      assert.strictEqual(email1, email2);
    });
  });

  describe('EphemeralMockServer (In-Memory HTTP Mock Server)', () => {
    it('Spins up in-memory HTTP server, executes REST CRUD and sub-resources', async () => {
      const server = new EphemeralMockServer({
        dataset: sampleRawDataset,
        prefix: '/api'
      });

      const { port, url } = await server.start();
      assert.ok(port > 0);
      assert.ok(url.startsWith('http://127.0.0.1:'));

      try {
        // Test health endpoint
        const healthRes = await fetch(`${url}/health`);
        assert.strictEqual(healthRes.status, 200);
        const healthData = await healthRes.json();
        assert.strictEqual(healthData.status, 'ok');
        assert.strictEqual(healthData.recordsCount.users, 2);

        // Test GET /api/users
        const usersRes = await fetch(`${url}/api/users`);
        assert.strictEqual(usersRes.status, 200);
        const users = await usersRes.json();
        assert.strictEqual(users.length, 2);

        // Test GET /api/users/101
        const singleUserRes = await fetch(`${url}/api/users/101`);
        assert.strictEqual(singleUserRes.status, 200);
        const user = await singleUserRes.json();
        assert.strictEqual(user.id, 101);

        // Test Relational child lookup: GET /api/users/101/orders
        const childRes = await fetch(`${url}/api/users/101/orders`);
        assert.strictEqual(childRes.status, 200);
        const userOrders = await childRes.json();
        assert.strictEqual(userOrders.length, 2);
        assert.strictEqual(userOrders[0].user_id, 101);
        assert.strictEqual(userOrders[1].user_id, 101);

        // Test POST /api/users
        const postRes = await fetch(`${url}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'new@corp.com', full_name: 'New Person' })
        });
        assert.strictEqual(postRes.status, 201);
        const created = await postRes.json();
        assert.ok(created.id);

        // Test DELETE /api/users/102
        const delRes = await fetch(`${url}/api/users/102`, { method: 'DELETE' });
        assert.strictEqual(delRes.status, 200);

        // Test OpenAPI spec
        const openApiRes = await fetch(`${url}/openapi.json`);
        assert.strictEqual(openApiRes.status, 200);
        const spec = await openApiRes.json();
        assert.strictEqual(spec.openapi, '3.0.0');
        assert.ok(spec.paths['/api/users']);
      } finally {
        await server.stop();
      }
    });
  });

  describe('OrmMigrationSynchronizer (Bidirectional ORM Diff & Synchronizer)', () => {
    it('Detects schema diffs between schema versions accurately', () => {
      const v1Schema = SqlDdlParser.parse(`
        CREATE TABLE users (
          id INT PRIMARY KEY,
          email VARCHAR(255) NOT NULL
        );
      `);

      const v2Schema = SqlDdlParser.parse(`
        CREATE TABLE users (
          id INT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50)
        );
        CREATE TABLE audit_logs (
          id INT PRIMARY KEY
        );
      `);

      const diff = OrmMigrationSynchronizer.diffSchemas(v1Schema, v2Schema);
      assert.strictEqual(diff.hasChanges, true);
      assert.deepStrictEqual(diff.addedTables, ['audit_logs']);
      assert.strictEqual(diff.removedTables.length, 0);
      assert.strictEqual(diff.modifiedTables.length, 1);
      assert.strictEqual(diff.modifiedTables[0].table, 'users');
      assert.deepStrictEqual(diff.modifiedTables[0].addedColumns, ['role']);
    });

    it('Generates synchronized seed fixtures for Prisma, Drizzle, SQLAlchemy, and Django', () => {
      const prismaFixture = OrmMigrationSynchronizer.generateFixture(sampleSchema, { orm: 'prisma', rowsPerTable: 5 });
      assert.strictEqual(prismaFixture.orm, 'prisma');
      assert.ok(prismaFixture.content.includes('.users.createMany'));

      const drizzleFixture = OrmMigrationSynchronizer.generateFixture(sampleSchema, { orm: 'drizzle', rowsPerTable: 5 });
      assert.strictEqual(drizzleFixture.orm, 'drizzle');
      assert.ok(drizzleFixture.content.includes('insert(') && drizzleFixture.content.includes('.users)'));

      const sqlAlchemyFixture = OrmMigrationSynchronizer.generateFixture(sampleSchema, { orm: 'sqlalchemy', rowsPerTable: 5 });
      assert.strictEqual(sqlAlchemyFixture.orm, 'sqlalchemy');
      assert.ok(sqlAlchemyFixture.content.includes('@pytest.fixture'));

      const djangoFixture = OrmMigrationSynchronizer.generateFixture(sampleSchema, { orm: 'django', rowsPerTable: 5 });
      assert.strictEqual(djangoFixture.orm, 'django');
      const parsedDjango = JSON.parse(djangoFixture.content);
      assert.ok(Array.isArray(parsedDjango));
      assert.ok(parsedDjango.length > 0);
    });
  });
});
