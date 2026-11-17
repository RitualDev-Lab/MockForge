import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SqlDdlParser } from '../src/parser/sql-parser.js';
import { DependencyGraph } from '../src/graph/dag.js';
import { RelationalSynthesisEngine } from '../src/generator/engine.js';
import { HighThroughputStreamingEngine } from '../src/generator/streaming-engine.js';
import { CdcExporter } from '../src/exporters/cdc.js';

describe('Phase 4: High-Throughput Relational Engine & Circular FK Auto-Resolution', () => {
  const circularSql = `
    CREATE TABLE departments (
      id UUID PRIMARY KEY,
      dept_name VARCHAR(100) NOT NULL,
      head_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE users (
      id UUID PRIMARY KEY,
      department_id UUID REFERENCES departments(id),
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  test('Kahn DAG automatically detects and breaks circular foreign key cycles', () => {
    const schema = SqlDdlParser.parse(circularSql, 'postgres');
    const graph = new DependencyGraph(schema);

    const { executionOrder, steps } = graph.resolveExecutionOrder();

    assert.equal(executionOrder.length, 2);
    // Verify that at least one table has deferred foreign keys
    const hasDeferred = steps.some((s) => s.deferredForeignKeys.length > 0);
    assert.equal(hasDeferred, true);
  });

  test('RelationalSynthesisEngine resolves circular foreign keys with 100% referential integrity', () => {
    const schema = SqlDdlParser.parse(circularSql, 'postgres');
    const engine = new RelationalSynthesisEngine(schema, {
      seed: 42,
      rowCounts: {
        departments: 50,
        users: 200,
      },
    });

    const dataset = engine.generate();
    assert.equal(dataset.tables['departments'].length, 50);
    assert.equal(dataset.tables['users'].length, 200);

    // Verify departments.head_user_id links to a valid users.id
    const userIds = new Set(dataset.tables['users'].map((u) => u.id));
    const deptHeadIds = dataset.tables['departments'].map((d) => d.head_user_id).filter(Boolean);
    assert.ok(deptHeadIds.length > 0);
    for (const headId of deptHeadIds) {
      assert.ok(userIds.has(headId));
    }

    // Verify users.department_id links to a valid departments.id
    const deptIds = new Set(dataset.tables['departments'].map((d) => d.id));
    const userDeptIds = dataset.tables['users'].map((u) => u.department_id).filter(Boolean);
    assert.ok(userDeptIds.length > 0);
    for (const deptId of userDeptIds) {
      assert.ok(deptIds.has(deptId));
    }
  });

  test('CdcExporter transforms dataset into Debezium CDC envelopes', () => {
    const schema = SqlDdlParser.parse(circularSql, 'postgres');
    const engine = new RelationalSynthesisEngine(schema, {
      seed: 42,
      defaultRowCount: 10,
    });
    const dataset = engine.generate();

    const bundle = CdcExporter.export(dataset);
    assert.equal(bundle.format, 'debezium-cdc');
    assert.equal(bundle.files.length, 2);

    const firstLine = JSON.parse(bundle.files[0].content.split('\n')[0]);
    assert.equal(firstLine.payload.op, 'c');
    assert.ok(firstLine.payload.after);
    assert.ok(firstLine.payload.source.table);
  });

  test('HighThroughputStreamingEngine scales to 100,000+ rows/sec with CDC event streaming', async () => {
    const throughputSql = `
      CREATE TABLE orders (
        id UUID PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE order_items (
        id UUID PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES orders(id),
        sku VARCHAR(50) NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      );
    `;

    const schema = SqlDdlParser.parse(throughputSql, 'postgres');
    const streamingEngine = new HighThroughputStreamingEngine(schema, {
      seed: 42,
      rowCounts: {
        orders: 15_000,
        order_items: 60_000,
      },
    });

    let eventCount = 0;
    const metrics = await streamingEngine.streamDebeziumEvents((event) => {
      eventCount++;
      assert.ok(event.payload.after.id);
    });

    console.log(`[High-Throughput Streaming] Streamed ${metrics.totalRowsGenerated.toLocaleString()} Debezium CDC events in ${metrics.durationMs.toFixed(2)}ms (${metrics.throughputRowsPerSec.toLocaleString()} rows/sec)`);

    assert.equal(metrics.totalRowsGenerated, 75_000);
    assert.equal(eventCount, 75_000);
    assert.ok(metrics.throughputRowsPerSec >= 100_000, `Expected >= 100,000 rows/sec, got ${metrics.throughputRowsPerSec}`);
  });
});
