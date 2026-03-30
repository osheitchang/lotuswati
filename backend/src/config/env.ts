const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const missing: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value) missing.push(name);
  return value || '';
}

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value && isProduction) {
    missing.push(name);
    return '';
  }
  return value || fallback;
}

function parseNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    missing.push(name);
    return fallback;
  }
  return parsed;
}

const PORT = parseNumber('PORT', 3001);

const FRONTEND_URL = requiredInProduction('FRONTEND_URL', 'http://localhost:3000');
const DATABASE_URL = required('DATABASE_URL');
const JWT_SECRET = required('JWT_SECRET');
const WA_VERIFY_TOKEN = required('WA_VERIFY_TOKEN');
const RATE_LIMIT_WINDOW_MS = parseNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = parseNumber('RATE_LIMIT_MAX_REQUESTS', 300);
const AUTH_RATE_LIMIT_MAX_REQUESTS = parseNumber('AUTH_RATE_LIMIT_MAX_REQUESTS', 20);

if (missing.length > 0) {
  throw new Error(`[ENV] Invalid or missing environment variable(s): ${missing.join(', ')}`);
}

export const env = {
  NODE_ENV,
  PORT,
  FRONTEND_URL,
  DATABASE_URL,
  JWT_SECRET,
  WA_VERIFY_TOKEN,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  AUTH_RATE_LIMIT_MAX_REQUESTS,
} as const;
