// PURE transforms for the Windy Point-Forecast v2 response (no cesium/DOM/network here).
// Response shape: { ts:[ms...], units:{...}, "temp-surface":[K...], "wind_u-surface":[m/s...],
// "wind_v-surface":[m/s...], "gust-surface":[m/s|null...], "rh-surface":[%...],
// "pressure-surface":[Pa...] }. Arrays are parallel, indexed by ts.

export const kToC = (k) => k - 273.15
export const msToKnots = (ms) => ms * 1.943844
export const paToHpa = (pa) => pa / 100

/**
 * Meteorological wind: speed (m/s) + direction the wind blows FROM (deg, 0=N, 90=E).
 * u = eastward, v = northward component.
 * @returns {{ speedMs:number, dirDeg:number }}
 */
export function windVector(u, v) {
  const speedMs = Math.hypot(u, v)
  const dirDeg = (Math.atan2(-u, -v) * 180) / Math.PI
  return { speedMs, dirDeg: (dirDeg + 360) % 360 }
}

/** 16-point compass label for a "from" bearing. */
export function compass(dirDeg) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return pts[Math.round(((dirDeg % 360) / 22.5)) % 16]
}

/**
 * Fold a point-forecast response into per-step conditions (+ a `now` shortcut).
 * @param {any} resp @returns {{ steps: Array<{tMs:number,tempC:number,windMs:number,windKt:number,dirDeg:number,dir:string,gustKt:(number|null),rh:(number|null),hpa:(number|null)}>, now: any }}
 */
export function summarizeForecast(resp) {
  const ts = Array.isArray(resp?.ts) ? resp.ts : []
  const at = (key, i) => {
    const arr = resp?.[key]
    const v = Array.isArray(arr) ? arr[i] : undefined
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  const steps = ts.map((tMs, i) => {
    const u = at('wind_u-surface', i)
    const v = at('wind_v-surface', i)
    const { speedMs, dirDeg } = u != null && v != null ? windVector(u, v) : { speedMs: null, dirDeg: null }
    const tempK = at('temp-surface', i)
    const gust = at('gust-surface', i)
    const rh = at('rh-surface', i)
    const pa = at('pressure-surface', i)
    return {
      tMs,
      tempC: tempK != null ? kToC(tempK) : null,
      windMs: speedMs,
      windKt: speedMs != null ? msToKnots(speedMs) : null,
      dirDeg,
      dir: dirDeg != null ? compass(dirDeg) : '',
      gustKt: gust != null ? msToKnots(gust) : null,
      rh,
      hpa: pa != null ? paToHpa(pa) : null,
    }
  })
  return { steps, now: steps[0] ?? null }
}
