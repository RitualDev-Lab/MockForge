import type { SeededPRNG } from '../prng.js';
import { PRODUCT_PREFIXES, PRODUCT_NOUNS } from '../data/domains.js';
import { COMPANIES, JOB_TITLES, DEPARTMENTS } from '../data/names.js';

export class EcommerceGenerator {
  static productName(prng: SeededPRNG): string {
    const prefix = prng.pick(PRODUCT_PREFIXES);
    const noun = prng.pick(PRODUCT_NOUNS);
    const modelNum = prng.int(100, 9900);
    return `${prefix} ${noun} ${modelNum}`;
  }

  static sku(prng: SeededPRNG): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const cat = prng.pick(letters) + prng.pick(letters) + prng.pick(letters);
    const num = String(prng.int(1000, 9999));
    return `SKU-${cat}-${num}`;
  }

  static orderNumber(prng: SeededPRNG): string {
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const tag = prng.string(6, chars);
    const num = String(prng.int(1000, 9999));
    return `ORD-${tag}-${num}`;
  }

  static company(prng: SeededPRNG): string {
    return prng.pick(COMPANIES);
  }

  static jobTitle(prng: SeededPRNG): string {
    return prng.pick(JOB_TITLES);
  }

  static department(prng: SeededPRNG): string {
    return prng.pick(DEPARTMENTS);
  }
}
