// HUD corner telemetry (04-ui-spec): camera-derived readouts, updated per frame-ish.
// NRO-cosplay fields (KH11/OPS/ORB/PASS) are static set-dressing per the UI spec.
import { Math as CMath, Viewer } from 'cesium'

function toDms(deg: number, posHemi: string, negHemi: string): string {
  const hemi = deg >= 0 ? posHemi : negHemi
  const a = Math.abs(deg)
  const d = Math.floor(a)
  const m = Math.floor((a - d) * 60)
  const s = ((a - d) * 60 - m) * 60
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(2)}"${hemi}`
}

export function initHud(viewer: Viewer) {
  const posEl = document.getElementById('hud-pos')!
  const altEl = document.getElementById('hud-alt')!
  const recEl = document.getElementById('hud-rec')!

  let last = 0
  viewer.clock.onTick.addEventListener(() => {
    const now = performance.now()
    if (now - last < 250) return // 4 Hz is plenty for a readout
    last = now
    const carto = viewer.camera.positionCartographic
    posEl.textContent = `${toDms(CMath.toDegrees(carto.latitude), 'N', 'S')} ${toDms(CMath.toDegrees(carto.longitude), 'E', 'W')}`
    const altM = carto.height
    altEl.textContent = `ALT: ${altM > 100_000 ? `${Math.round(altM / 1000)}KM` : `${Math.round(altM)}M`}  SUN: --`
    recEl.textContent = `REC ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z`
  })
}
