/** Comma-separated browser origins allowed to call the API (web admin, etc.). */
export function parseCorsOrigins(raw: string | undefined, nodeEnv: string): string[] | false {
  if (raw?.trim()) {
    const origins = raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return origins.length > 0 ? origins : false;
  }

  if (nodeEnv === 'development') {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }

  return false;
}
