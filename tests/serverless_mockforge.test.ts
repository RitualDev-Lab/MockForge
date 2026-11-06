import { describe, it } from 'node:test';
import assert from 'node:assert';
import worker from '../serverless/worker.js';

describe('api.mockforge.io Serverless Edge Worker Suite', () => {
  const env = {
    API_SECRET_KEY: 'test-mockforge-key-777'
  };

  const sampleSql = `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(150) NOT NULL
    );

    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      total_amount NUMERIC(10, 2) NOT NULL
    );
  `;

  it('Serves GET /v1/health with $0 cost and supported dialects', async () => {
    const req = new Request('https://api.mockforge.io/v1/health', { method: 'GET' });
    const res = await worker.fetch(req, {}, {});

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'api.mockforge.io');
    assert.strictEqual(data.cost, '$0.00/month');
    assert.ok(data.supportedFormats.includes('postgres'));
    assert.ok(data.supportedFormats.includes('prisma'));
  });

  it('Generates relational JSON mock fixtures over HTTP POST', async () => {
    const req = new Request('https://api.mockforge.io/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-mockforge-key-777'
      },
      body: JSON.stringify({
        schema: sampleSql,
        format: 'json',
        rows: 10,
        seed: 42
      })
    });

    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const result = await res.json();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.format, 'json');
    assert.strictEqual(result.tables.length, 2);
    assert.deepStrictEqual(result.executionOrder, ['users', 'orders']);
    assert.strictEqual(result.data.users.length, 10);
    assert.strictEqual(result.data.orders.length, 10);
    assert.ok(result.durationMs >= 0);

    // Verify foreign key reference integrity
    const userIds = new Set(result.data.users.map((u: any) => u.id));
    for (const order of result.data.orders) {
      assert.ok(userIds.has(order.user_id), 'Order user_id must point to a valid user id');
    }
  });

  it('Generates Postgres SQL seed scripts over HTTP POST', async () => {
    const req = new Request('https://api.mockforge.io/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-mockforge-key-777'
      },
      body: JSON.stringify({
        schema: sampleSql,
        format: 'postgres',
        rows: 5
      })
    });

    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const result = await res.json();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.format, 'postgres');
    assert.ok(result.content.includes('INSERT INTO "users"'));
    assert.ok(result.content.includes('INSERT INTO "orders"'));
  });

  it('Anonymizes production datasets via POST /v1/mask endpoint', async () => {
    const rawData = {
      users: [
        { id: 1, email: 'ceo@megacorp.com', full_name: 'Johnathan Doe', ssn: '000-11-2222' }
      ]
    };

    const req = new Request('https://api.mockforge.io/v1/mask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-mockforge-key-777'
      },
      body: JSON.stringify({
        dataset: rawData,
        salt: 'enterprise-salt-v1'
      })
    });

    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const result = await res.json();

    assert.strictEqual(result.success, true);
    assert.notStrictEqual(result.data.users[0].email, 'ceo@megacorp.com');
    assert.notStrictEqual(result.data.users[0].full_name, 'Johnathan Doe');
    assert.strictEqual(result.data.users[0].id, 1); // ID preserved
    assert.strictEqual(result.auditReport.compliance.hipaaCompliant, true);
  });

  it('Diffs schemas and generates migration fixture via POST /v1/diff endpoint', async () => {
    const prevSchema = 'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE);';
    const currSchema = `
      CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, role VARCHAR(50));
      CREATE TABLE audit_logs (id SERIAL PRIMARY KEY);
    `;

    const req = new Request('https://api.mockforge.io/v1/diff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-mockforge-key-777'
      },
      body: JSON.stringify({
        previousSchema: prevSchema,
        currentSchema: currSchema,
        orm: 'prisma',
        rows: 5
      })
    });

    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const result = await res.json();

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.diff.addedTables, ['audit_logs']);
    assert.strictEqual(result.fixture.orm, 'prisma');
    assert.ok(result.fixture.content.includes('.users.createMany'));
  });
});
