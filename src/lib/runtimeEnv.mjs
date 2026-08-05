export function normalizeRuntimeEnvValue(value) {
  let normalized = String(value ?? '').trim();

  while (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if ((first !== '"' && first !== "'") || last !== first) break;
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}
