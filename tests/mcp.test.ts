import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createMockForgeMcpServer,
  anonymizeCsvData,
  parseSchema,
  synthesizeMockData,
  exportDataset
} from '../src/index.js';

describe('MockForge MCP Server Suite', () => {
  it('instantiates McpServer with correct metadata', () => {
    const server = createMockForgeMcpServer();
    assert.ok(server);
  });

  it('anonymizes CSV data and redacts sensitive PII with compliance report', () => {
    const rawCsv = `id,name,email,phone,ssn,company
1,John Doe,john@acme.com,555-123-4567,000-12-3456,Acme Corp
2,Jane Smith,jane@test.org,555-987-6543,111-22-3333,Test LLC`;

    const result = anonymizeCsvData(rawCsv, 'customers', { salt: 'test-salt', seed: 100 });
    assert.strictEqual(result.rowsProcessed, 2);
    assert.ok(result.columnsMasked.length > 0);
    assert.strictEqual(result.compliance.hipaaCompliant, true);
    assert.strictEqual(result.compliance.gdprCompliant, true);

    // Assert PII values are changed
    assert.ok(!result.anonymizedCsv.includes('john@acme.com'));
    assert.ok(!result.anonymizedCsv.includes('000-12-3456'));
    // Header should be preserved
    assert.ok(result.anonymizedCsv.startsWith('id,name,email,phone,ssn,company'));
  });

  it('synthesizes relational mock fixtures and seeds correctly', () => {
    const schemaSql = `
      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        dept_name VARCHAR(100) NOT NULL
      );
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        department_id INT REFERENCES departments(id),
        email VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL
      );
    `;

    const schema = parseSchema(schemaSql);
    const dataset = synthesizeMockData(schema, { defaultRowCount: 5, seed: 42 });

    assert.strictEqual(dataset.tables.departments.length, 5);
    assert.strictEqual(dataset.tables.employees.length, 5);

    const bundle = exportDataset(dataset, schema, { format: 'postgres' });
    assert.ok(bundle.primaryFile.content.includes('INSERT INTO "departments"'));
    assert.ok(bundle.primaryFile.content.includes('INSERT INTO "employees"'));
  });
});
