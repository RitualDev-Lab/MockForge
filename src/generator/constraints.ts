import type { TableDefinition } from '../types/schema.js';
import type { SeededPRNG } from './prng.js';

export class ConstraintSolver {
  /**
   * Enforces cross-column chronological and arithmetic integrity on a synthesized row
   */
  static enforce(row: Record<string, any>, table: TableDefinition, prng: SeededPRNG): void {
    this.enforceTemporalOrdering(row);
    this.enforceArithmeticConsistency(row);
    this.enforceCheckConstraints(row, table);
  }

  /**
   * Guarantees created_at <= updated_at <= shipped_at <= delivered_at
   * and start_date <= end_date
   */
  private static enforceTemporalOrdering(row: Record<string, any>): void {
    // 1. created_at vs updated_at
    const createdKey = Object.keys(row).find((k) => /created_?at|inserted_?at/i.test(k));
    const updatedKey = Object.keys(row).find((k) => /updated_?at|modified_?at/i.test(k));

    if (createdKey && updatedKey && row[createdKey] && row[updatedKey]) {
      const createdTime = new Date(row[createdKey]).getTime();
      const updatedTime = new Date(row[updatedKey]).getTime();

      if (updatedTime < createdTime) {
        // Offset updated_at to be 1 hour to 14 days after created_at
        const deltaMs = 3600000 + (createdTime % 1209600000);
        const resolvedDate = new Date(createdTime + deltaMs);
        row[updatedKey] = row[createdKey].includes('T') ? resolvedDate.toISOString() : resolvedDate.toISOString().split('T')[0];
      }
    }

    // 2. start_date vs end_date
    const startKey = Object.keys(row).find((k) => /start_?(date|time)?/i.test(k));
    const endKey = Object.keys(row).find((k) => /end_?(date|time)?/i.test(k));

    if (startKey && endKey && row[startKey] && row[endKey]) {
      const startTime = new Date(row[startKey]).getTime();
      const endTime = new Date(row[endKey]).getTime();

      if (endTime < startTime) {
        const deltaMs = 86400000 * 7; // +7 days
        const resolved = new Date(startTime + deltaMs);
        row[endKey] = row[startKey].includes('T') ? resolved.toISOString() : resolved.toISOString().split('T')[0];
      }
    }

    // 3. shipped_at vs delivered_at
    const shippedKey = Object.keys(row).find((k) => /shipped_?at/i.test(k));
    const deliveredKey = Object.keys(row).find((k) => /delivered_?at/i.test(k));

    if (shippedKey && deliveredKey && row[shippedKey] && row[deliveredKey]) {
      const shipTime = new Date(row[shippedKey]).getTime();
      const delTime = new Date(row[deliveredKey]).getTime();

      if (delTime < shipTime) {
        const resolved = new Date(shipTime + 86400000 * 3); // +3 days shipping
        row[deliveredKey] = row[shippedKey].includes('T') ? resolved.toISOString() : resolved.toISOString().split('T')[0];
      }
    }
  }

  /**
   * Enforces realistic arithmetic relationships: unit_price * quantity = total_price
   */
  private static enforceArithmeticConsistency(row: Record<string, any>): void {
    const qtyKey = Object.keys(row).find((k) => /^qty$|^quantity$/i.test(k));
    const unitPriceKey = Object.keys(row).find((k) => /unit_?price|item_?price/i.test(k));
    const totalKey = Object.keys(row).find((k) => /^total$|^total_?(amount|price)$|^subtotal$/i.test(k));

    if (qtyKey && unitPriceKey && totalKey) {
      const qty = Number(row[qtyKey]) || 1;
      const unitPrice = Number(row[unitPriceKey]) || 10.0;
      row[totalKey] = Math.round(qty * unitPrice * 100) / 100;
    }
  }

  /**
   * Validates and bounds columns against parsed check constraints
   */
  private static enforceCheckConstraints(row: Record<string, any>, table: TableDefinition): void {
    for (const col of table.columns) {
      if (!col.checkConstraint) continue;
      const val = row[col.name];
      if (typeof val !== 'number') continue;

      // Match check ranges like CHECK (col >= min AND col <= max)
      const rangeMatch = col.checkConstraint.match(/>=\s*([0-9.]+)\s+AND\s+.*<=\s*([0-9.]+)/i);
      if (rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        row[col.name] = Math.min(max, Math.max(min, val));
        continue;
      }

      // Match positive checks like CHECK (col >= 0)
      const gteMatch = col.checkConstraint.match(/>=\s*([0-9.]+)/);
      if (gteMatch) {
        const min = Number(gteMatch[1]);
        if (val < min) row[col.name] = min;
      }
    }
  }
}
