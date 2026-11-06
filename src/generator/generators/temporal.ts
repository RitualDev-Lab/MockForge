import type { SeededPRNG } from '../prng.js';

// Fixed base epoch for 100% reproducible deterministic generation across runs
const DEFAULT_REFERENCE_TIME = new Date('2026-06-01T00:00:00.000Z').getTime();

export class TemporalGenerator {
  static datePast(prng: SeededPRNG, maxDays = 365, referenceTime = DEFAULT_REFERENCE_TIME): Date {
    const msPerDay = 86400000;
    const offsetMs = prng.int(1, maxDays) * msPerDay + prng.int(0, msPerDay - 1);
    return new Date(referenceTime - offsetMs);
  }

  static dateFuture(prng: SeededPRNG, maxDays = 365, referenceTime = DEFAULT_REFERENCE_TIME): Date {
    const msPerDay = 86400000;
    const offsetMs = prng.int(1, maxDays) * msPerDay + prng.int(0, msPerDay - 1);
    return new Date(referenceTime + offsetMs);
  }

  static isoTimestamp(prng: SeededPRNG, baseDate?: Date): string {
    const d = baseDate || this.datePast(prng);
    return d.toISOString();
  }

  static birthDate(prng: SeededPRNG, minAge = 18, maxAge = 75, referenceYear = 2026): Date {
    const birthYear = referenceYear - prng.int(minAge, maxAge);
    const month = prng.int(0, 11);
    const day = prng.int(1, 28);
    return new Date(birthYear, month, day);
  }
}
