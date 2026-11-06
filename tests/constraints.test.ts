import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConstraintSolver } from '../src/generator/constraints.js';
import { SeededPRNG } from '../src/generator/prng.js';
import type { TableDefinition } from '../src/types/schema.js';

describe('ConstraintSolver Cross-Column & Temporal Tests', () => {
  const prng = new SeededPRNG(42);

  const dummyTable: TableDefinition = {
    name: 'orders',
    columns: [
      { name: 'id', rawType: 'uuid', normalizedType: 'uuid', isNullable: false, isPrimaryKey: true, isUnique: true, isAutoIncrement: false },
      { name: 'quantity', rawType: 'int', normalizedType: 'integer', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'unit_price', rawType: 'numeric(10,2)', normalizedType: 'decimal', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'total_amount', rawType: 'numeric(10,2)', normalizedType: 'decimal', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'created_at', rawType: 'timestamptz', normalizedType: 'timestamp', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'updated_at', rawType: 'timestamptz', normalizedType: 'timestamp', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'shipped_at', rawType: 'timestamptz', normalizedType: 'timestamp', isNullable: true, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'delivered_at', rawType: 'timestamptz', normalizedType: 'timestamp', isNullable: true, isPrimaryKey: false, isUnique: false, isAutoIncrement: false },
      { name: 'age', rawType: 'int', normalizedType: 'integer', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false, checkConstraint: 'CHECK (age >= 18 AND age <= 99)' },
      { name: 'discount_rate', rawType: 'decimal', normalizedType: 'decimal', isNullable: false, isPrimaryKey: false, isUnique: false, isAutoIncrement: false, checkConstraint: 'CHECK (discount_rate >= 0)' }
    ],
    primaryKey: ['id'],
    foreignKeys: [],
    uniqueConstraints: [],
    checkConstraints: []
  };

  test('Guarantees updated_at is chronologically greater than or equal to created_at', () => {
    const row = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      created_at: '2026-05-10T12:00:00.000Z',
      updated_at: '2026-01-01T08:00:00.000Z' // Anachronistic: 4 months prior
    };

    ConstraintSolver.enforce(row, dummyTable, prng);

    const createdTime = new Date(row.created_at).getTime();
    const updatedTime = new Date(row.updated_at).getTime();
    assert.ok(updatedTime >= createdTime, `updated_at (${row.updated_at}) must be >= created_at (${row.created_at})`);
  });

  test('Guarantees delivered_at is chronologically greater than shipped_at', () => {
    const row = {
      shipped_at: '2026-06-15T10:00:00.000Z',
      delivered_at: '2026-06-10T09:00:00.000Z' // Prior to shipping
    };

    ConstraintSolver.enforce(row, dummyTable, prng);

    const shipTime = new Date(row.shipped_at).getTime();
    const delTime = new Date(row.delivered_at).getTime();
    assert.ok(delTime >= shipTime, `delivered_at (${row.delivered_at}) must be >= shipped_at (${row.shipped_at})`);
  });

  test('Guarantees start_date precedes end_date', () => {
    const row = {
      start_date: '2026-08-01',
      end_date: '2026-07-20'
    };

    ConstraintSolver.enforce(row, dummyTable, prng);

    const startTime = new Date(row.start_date).getTime();
    const endTime = new Date(row.end_date).getTime();
    assert.ok(endTime >= startTime, `end_date (${row.end_date}) must be >= start_date (${row.start_date})`);
  });

  test('Calculates mathematically coherent total = quantity * unit_price', () => {
    const row = {
      quantity: 5,
      unit_price: 19.99,
      total_amount: 0 // Incorrect initially
    };

    ConstraintSolver.enforce(row, dummyTable, prng);

    // 5 * 19.99 = 99.95
    assert.equal(row.total_amount, 99.95);
  });

  test('Enforces parsed SQL check constraint range bounds', () => {
    // Under-bound test
    const rowUnder = { age: 14, discount_rate: -10 };
    ConstraintSolver.enforce(rowUnder, dummyTable, prng);
    assert.equal(rowUnder.age, 18, 'Underage value must be bounded to min 18');
    assert.equal(rowUnder.discount_rate, 0, 'Negative discount must be bounded to 0');

    // Over-bound test
    const rowOver = { age: 120, discount_rate: 15 };
    ConstraintSolver.enforce(rowOver, dummyTable, prng);
    assert.equal(rowOver.age, 99, 'Over-age value must be bounded to max 99');
    assert.equal(rowOver.discount_rate, 15);
  });
});
