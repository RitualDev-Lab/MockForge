import type { SeededPRNG } from '../prng.js';
import { COUNTRIES, US_STATES, CITIES, STREETS } from '../data/geo.js';

export class GeoGenerator {
  static country(prng: SeededPRNG): { name: string; code: string; currency: string } {
    return prng.pick(COUNTRIES);
  }

  static state(prng: SeededPRNG): { name: string; code: string } {
    return prng.pick(US_STATES);
  }

  static city(prng: SeededPRNG): string {
    return prng.pick(CITIES);
  }

  static streetAddress(prng: SeededPRNG): string {
    const num = prng.int(10, 9999);
    const street = prng.pick(STREETS);
    return `${num} ${street}`;
  }

  static zipCode(prng: SeededPRNG): string {
    return String(prng.int(10001, 99950));
  }

  static latitude(prng: SeededPRNG): number {
    return prng.float(-90, 90, 6);
  }

  static longitude(prng: SeededPRNG): number {
    return prng.float(-180, 180, 6);
  }

  static ipv4(prng: SeededPRNG): string {
    return `${prng.int(10, 220)}.${prng.int(0, 255)}.${prng.int(0, 255)}.${prng.int(1, 254)}`;
  }

  static ipv6(prng: SeededPRNG): string {
    const parts: string[] = [];
    for (let i = 0; i < 8; i++) {
      parts.push(prng.int(0, 65535).toString(16).padStart(4, '0'));
    }
    return parts.join(':');
  }

  static macAddress(prng: SeededPRNG): string {
    const parts: string[] = [];
    for (let i = 0; i < 6; i++) {
      parts.push(prng.int(0, 255).toString(16).padStart(2, '0'));
    }
    return parts.join(':');
  }
}
