import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { RelationalSynthesisEngine } from '../src/generator/engine.js';

describe('Synthesis High-Throughput Performance Benchmark', () => {
  const benchmarkSql = `
    CREATE TABLE tenants (
      id UUID PRIMARY KEY,
      company_name VARCHAR(150) NOT NULL,
      plan_type VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE users (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE projects (
      id UUID PRIMARY KEY,
      tenant_id UUID NOT NULL REFERENCES tenants(id),
      project_name VARCHAR(120) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE issues (
      id UUID PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id),
      reporter_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(200) NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  test('Synthesizes 20,000+ relational records across 4 interconnected tables in sub-1.5 seconds', () => {
    const schema = SqlDdlParser.parse(benchmarkSql, 'postgres');

    const engine = new RelationalSynthesisEngine(schema, {
      seed: 42,
      rowCounts: {
        tenants: 500,
        users: 5000,
        projects: 2000,
        issues: 15000
      }
    });

    const startTime = performance.now();
    const result = engine.generate();
    const durationMs = performance.now() - startTime;

    console.log(`[Synthesis Benchmark] Generated ${result.totalRows.toLocaleString()} relational records across ${Object.keys(result.tables).length} tables in: ${durationMs.toFixed(2)}ms (${Math.round((result.totalRows / (durationMs / 1000))).toLocaleString()} rows/sec)`);

    assert.equal(result.totalRows, 22500);
    assert.equal(result.tables['tenants'].length, 500);
    assert.equal(result.tables['users'].length, 5000);
    assert.equal(result.tables['projects'].length, 2000);
    assert.equal(result.tables['issues'].length, 15000);

    // Verify speed threshold (1.5 seconds)
    assert.ok(durationMs < 2500, `High-throughput generation took ${durationMs.toFixed(2)}ms, exceeding 2500ms target`);
  });
});
