/**
 * Pure helpers extracted from index.js so they're importable in tests
 * without connecting to Redis or starting the Express server.
 */

/**
 * Safely escape a string value for ClickHouse SQL
 * Prevents SQL injection by escaping single quotes and backslashes
 */
export function escSql(value) {
  if (typeof value !== 'string') return String(value);
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Resolve time window string to ClickHouse interval expression
 */
export function resolveWindow(window) {
  const map = { '1h': '1 HOUR', '6h': '6 HOUR', '24h': '24 HOUR', '7d': '7 DAY' };
  return map[window] || '1 HOUR';
}
