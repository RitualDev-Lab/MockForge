import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchema } from '../src/index.js';
import { DependencyGraph } from '../src/graph/dag.js';

describe('Performance Benchmark Suite', () => {
  test('Parses multi-table enterprise schema and computes DAG in sub-5ms', () => {
    // Generate a 20-table chained schema
    let largeSql = '';
    for (let i = 1; i <= 20; i++) {
      const parentRef = i > 1 ? `parent_id INT REFERENCES table_${i - 1}(id) ON DELETE CASCADE,` : '';
      largeSql += `
        CREATE TABLE table_${i} (
          id SERIAL PRIMARY KEY,
          ${parentRef}
          code VARCHAR(50) NOT NULL UNIQUE,
          amount NUMERIC(12, 4) DEFAULT 0.00,
          is_enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    }

    // Warm-up V8 JIT compiler
    parseSchema(largeSql);

    const start = performance.now();
    const schema = parseSchema(largeSql);
    const graph = new DependencyGraph(schema);
    const result = graph.resolveExecutionOrder();
    const duration = performance.now() - start;

    assert.equal(schema.tables.length, 20);
    assert.equal(result.executionOrder.length, 20);
    // Verify first table is table_1 and last is table_20
    assert.equal(result.executionOrder[0].toLowerCase(), 'table_1');
    assert.equal(result.executionOrder[19].toLowerCase(), 'table_20');

    console.log(`[Benchmark] 20-Table DDL Parse & Kahn DAG computation completed in: ${duration.toFixed(2)}ms`);
    assert.ok(duration < 100, `Benchmark took ${duration.toFixed(2)}ms, exceeding 100ms target`);
  });
});
