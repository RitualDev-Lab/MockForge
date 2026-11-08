import { createHash } from "node:crypto";

/**
 * Seeded Pseudorandom Number Generator (Mulberry32) with Statistical Distributions
 * and Cryptographic SHA-256 Seed-Locking.
 * Guarantees 100% reproducible synthetic database generation across machines and processes.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number | string = 42) {
    if (typeof seed === "string") {
      const hash = createHash("sha256").update(seed).digest();
      this.state = hash.readUInt32BE(0) >>> 0;
    } else {
      this.state = seed >>> 0;
    }
  }

  /**
   * Factory constructor accepting either numeric or cryptographic string seeds.
   */
  static fromSeed(seed: number | string): SeededPRNG {
    return new SeededPRNG(seed);
  }

  /**
   * Derives an isolated child PRNG deterministically bound to a sub-domain (e.g. table, column)
   */
  deriveChild(domain: string): SeededPRNG {
    const hash = createHash("sha256")
      .update(`${this.state}:${domain}`)
      .digest();
    return new SeededPRNG(hash.readUInt32BE(0));
  }

  /**
   * Generates a floating point number in [0, 1)
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates an integer in [min, max] inclusive
   */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Generates a float in [min, max) with fixed decimal precision
   */
  float(min: number, max: number, precision = 2): number {
    const val = this.next() * (max - min) + min;
    const factor = Math.pow(10, precision);
    return Math.round(val * factor) / factor;
  }

  /**
   * Returns true with given probability [0, 1]
   */
  boolean(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Randomly selects one element from an array
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Randomly samples N distinct elements from an array
   */
  sample<T>(array: readonly T[], count: number): T[] {
    const copy = [...array];
    const n = Math.min(count, copy.length);
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
      const idx = this.int(0, copy.length - 1);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  /**
   * Normal (Gaussian) distribution using Box-Muller transform
   * Ideal for realistic pricing, salaries, and user metrics
   */
  gaussian(mean: number, stdDev: number): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 === 0) u1 = this.next(); // Avoid log(0)
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Power-law / Zipfian distribution (80/20 Pareto principle)
   * Ideal for realistic relational foreign key distribution (e.g. power users place most orders)
   */
  zipf(n: number, skew = 1.0): number {
    if (n <= 1) return 0;
    // Fast inverse transform sampling approximation
    const p = this.next();
    const rank = Math.floor(Math.pow(1 - p, -1 / (skew + 0.1)));
    return Math.min(rank - 1, n - 1);
  }

  /**
   * Deterministic UUID v4 generation from PRNG state
   */
  uuid(): string {
    const hex = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        s += '-';
      } else if (i === 14) {
        s += '4'; // UUID version 4
      } else if (i === 19) {
        s += hex[(this.int(0, 15) & 0x3) | 0x8]; // Variant
      } else {
        s += hex[this.int(0, 15)];
      }
    }
    return s;
  }

  /**
   * Deterministic NanoID generation (21 characters)
   */
  nanoid(size = 21): string {
    const alphabet = 'useandom-26T1983_40STabcdfghjklmnpqrtvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id = '';
    for (let i = 0; i < size; i++) {
      id += alphabet[this.int(0, alphabet.length - 1)];
    }
    return id;
  }

  /**
   * Deterministic random string with configurable character set
   */
  string(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[this.int(0, charset.length - 1)];
    }
    return result;
  }

  /**
   * Deterministic CUID-style ID generation
   */
  cuid(): string {
    const timeSegment = this.int(1000000, 9999999).toString(36);
    return 'c' + timeSegment + this.nanoid(12).toLowerCase();
  }
}
