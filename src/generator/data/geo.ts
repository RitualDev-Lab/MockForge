export const COUNTRIES = [
  { name: 'United States', code: 'US', currency: 'USD' },
  { name: 'United Kingdom', code: 'GB', currency: 'GBP' },
  { name: 'Canada', code: 'CA', currency: 'CAD' },
  { name: 'Germany', code: 'DE', currency: 'EUR' },
  { name: 'France', code: 'FR', currency: 'EUR' },
  { name: 'India', code: 'IN', currency: 'INR' },
  { name: 'Japan', code: 'JP', currency: 'JPY' },
  { name: 'Australia', code: 'AU', currency: 'AUD' },
  { name: 'Singapore', code: 'SG', currency: 'SGD' },
  { name: 'Netherlands', code: 'NL', currency: 'EUR' },
  { name: 'Switzerland', code: 'CH', currency: 'CHF' },
  { name: 'Sweden', code: 'SE', currency: 'SEK' }
] as const;

export const US_STATES = [
  { name: 'California', code: 'CA' },
  { name: 'New York', code: 'NY' },
  { name: 'Texas', code: 'TX' },
  { name: 'Florida', code: 'FL' },
  { name: 'Illinois', code: 'IL' },
  { name: 'Washington', code: 'WA' },
  { name: 'Massachusetts', code: 'MA' },
  { name: 'Colorado', code: 'CO' },
  { name: 'Georgia', code: 'GA' },
  { name: 'North Carolina', code: 'NC' },
  { name: 'Virginia', code: 'VA' },
  { name: 'Ohio', code: 'OH' }
] as const;

export const CITIES = [
  'San Francisco', 'New York', 'Austin', 'Seattle', 'London', 'Berlin',
  'Tokyo', 'Paris', 'Toronto', 'Singapore', 'Sydney', 'Amsterdam',
  'Chicago', 'Denver', 'Boston', 'Zurich', 'Stockholm', 'Dublin'
] as const;

export const STREETS = [
  'Market Street', 'Broadway', 'Main Street', 'Fifth Avenue', 'Wall Street',
  'High Street', 'King Street', 'Queen Street', 'Park Avenue', 'Oak Lane',
  'Maple Boulevard', 'Sunset Strip', 'Lexington Avenue', 'Elm Street', 'Cedar Way'
] as const;
