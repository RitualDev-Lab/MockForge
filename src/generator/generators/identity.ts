import type { SeededPRNG } from '../prng.js';
import { FIRST_NAMES, LAST_NAMES } from '../data/names.js';
import { EMAIL_DOMAINS } from '../data/domains.js';

export class IdentityGenerator {
  static firstName(prng: SeededPRNG): string {
    return prng.pick(FIRST_NAMES);
  }

  static lastName(prng: SeededPRNG): string {
    return prng.pick(LAST_NAMES);
  }

  static fullName(prng: SeededPRNG): string {
    return `${this.firstName(prng)} ${this.lastName(prng)}`;
  }

  static username(prng: SeededPRNG, first?: string, last?: string): string {
    const f = (first || this.firstName(prng)).toLowerCase().replace(/[^a-z0-9]/g, '');
    const l = (last || this.lastName(prng)).toLowerCase().replace(/[^a-z0-9]/g, '');
    const suffix = prng.int(10, 999);
    const formats = [
      `${f}.${l}`,
      `${f}_${l}`,
      `${f}${l[0]}${suffix}`,
      `${f[0]}${l}${suffix}`,
      `${f}${suffix}`
    ];
    return prng.pick(formats);
  }

  static email(prng: SeededPRNG, user?: string): string {
    const u = user || this.username(prng);
    const domain = prng.pick(EMAIL_DOMAINS);
    return `${u}@${domain}`;
  }

  static phone(prng: SeededPRNG): string {
    // Standard US/International formatted phone +1 (NXX) NXX-XXXX
    const area = prng.int(201, 989);
    const prefix = prng.int(200, 999);
    const line = prng.int(1000, 9999);
    return `+1-${area}-${prefix}-${line}`;
  }

  static avatarUrl(prng: SeededPRNG, seedName?: string): string {
    const seed = seedName || prng.nanoid(8);
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
  }

  static ssn(prng: SeededPRNG): string {
    const area = prng.int(100, 899);
    const group = prng.int(10, 99);
    const serial = prng.int(1000, 9999);
    return `${area}-${group}-${serial}`;
  }

  static pan(prng: SeededPRNG): string {
    // Indian PAN format: [A-Z]{5}[0-9]{4}[A-Z]
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 5; i++) s += prng.pick(letters as any);
    s += String(prng.int(1000, 9999));
    s += prng.pick(letters as any);
    return s;
  }

  static aadhaar(prng: SeededPRNG): string {
    // 12-digit Indian Aadhaar with valid Verhoeff checksum
    let digits = '';
    for (let i = 0; i < 11; i++) {
      digits += String(i === 0 ? prng.int(2, 9) : prng.int(0, 9));
    }
    const check = this.computeVerhoeff(digits);
    const full = digits + check;
    return `${full.slice(0, 4)} ${full.slice(4, 8)} ${full.slice(8, 12)}`;
  }

  private static computeVerhoeff(numStr: string): number {
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];
    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];
    const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

    let c = 0;
    const rev = numStr.split('').reverse().map(Number);
    for (let i = 0; i < rev.length; i++) {
      c = d[c][p[(i + 1) % 8][rev[i]]];
    }
    return inv[c];
  }
}
