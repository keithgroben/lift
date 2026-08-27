export function clampRentLevel(level, config) {
  return Math.max(config.pricing.minLevel, Math.min(config.pricing.maxLevel, Math.round(level)));
}

export function rentForLevel(config, kind, level) {
  const base = config.units[kind].rent;
  const clamped = clampRentLevel(level, config);
  return Math.round(base * (1 + clamped * config.pricing.stepMultiplier));
}
