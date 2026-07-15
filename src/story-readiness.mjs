const LEVELS = new Set(['pass', 'warn', 'fail'])
const CHECK_NAMES = ['camera', 'tiles', 'sources', 'overlays', 'contrast']

/** Normalize Story-mode checks into the public readiness response. */
export function summarizeStoryReadiness(checks, fallbackApplied = false) {
  for (const name of CHECK_NAMES) {
    const check = checks?.[name]
    if (!check || !LEVELS.has(check.level) || typeof check.detail !== 'string') {
      throw new TypeError(`story readiness requires ${name} level and detail`)
    }
  }
  return {
    ready: !CHECK_NAMES.some((name) => checks[name].level === 'fail'),
    fallbackApplied,
    checks: Object.fromEntries(CHECK_NAMES.map((name) => [name, checks[name].level])),
    warnings: CHECK_NAMES
      .filter((name) => checks[name].level !== 'pass')
      .map((name) => `${name}: ${checks[name].detail}`),
  }
}

/** A camera fallback can only repair visual-frame checks, never missing provenance. */
export function needsStoryFallback(readiness) {
  return ['camera', 'contrast'].some((name) => readiness.checks[name] === 'fail')
}
