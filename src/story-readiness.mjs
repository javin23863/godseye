const LEVELS = new Set(['pass', 'warn', 'fail'])
const CHECK_NAMES = ['camera', 'tiles', 'sources', 'overlays', 'contrast']

export function storySafeBounds(width, height) {
  const vertical = width / height <= 0.75
  const captionReserve = Math.max(27, height * (vertical ? 0.24 : 0.18))
  const insetX = Math.max(28, width * 0.04)
  const insetY = Math.max(30, height * 0.04)
  return { left: insetX, top: insetY, right: width - insetX, bottom: height - captionReserve, captionReserve }
}

export function summarizeStoryTiles(globeTilesLoaded, visibleTilesets = [], renderedCoverageReady = false) {
  if (!globeTilesLoaded && !renderedCoverageReady) return { level: 'fail', detail: 'globe tiles are still loading' }
  const pending = visibleTilesets.filter((tileset) => !tileset.tilesLoaded).length
  if (pending) {
    return { level: 'fail', detail: `${pending} visible 3D tileset${pending === 1 ? '' : 's'} still loading` }
  }
  if (!globeTilesLoaded) {
    return { level: 'warn', detail: 'visible globe coverage is rendered; background refinement remains' }
  }
  return {
    level: 'pass',
    detail: visibleTilesets.length
      ? `globe and ${visibleTilesets.length} visible 3D tileset${visibleTilesets.length === 1 ? '' : 's'} ready`
      : 'globe tiles ready',
  }
}

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
