// Timeline playback (M3, CAP: 4D replay): scrub recorded snapshots; satellites
// re-propagate from TLEs at the playback instant (no recording needed for orbits).
import type { Aircraft, AircraftLayer } from './aircraft'
import type { GpsJamLayer } from './gpsjam'
import type { Quake, QuakeLayer } from './quakes'
import type { SatelliteLayer } from './satellites'
import type { Ship, ShipLayer } from './ships'
import { recordedRange, snapshotsAt } from './recorder'

const SPEEDS = [
  { label: '1×', mult: 1 },
  { label: '60×', mult: 60 },
  { label: '15m/s', mult: 900 },
  { label: '1h/s', mult: 3600 },
  { label: '6h/s', mult: 21600 },
]

export function initPlayback(opts: {
  flights: AircraftLayer
  military: AircraftLayer
  quakes: QuakeLayer
  sats: SatelliteLayer
  ships?: ShipLayer
  gpsjam: GpsJamLayer
  onStatus: (text: string) => void
}) {
  const bar = document.getElementById('timeline')!
  const toggle = document.getElementById('pb-toggle') as HTMLButtonElement
  const play = document.getElementById('pb-play') as HTMLButtonElement
  const speedSel = document.getElementById('pb-speed') as HTMLSelectElement
  const slider = document.getElementById('pb-slider') as HTMLInputElement
  const readout = document.getElementById('pb-time')!

  for (const s of SPEEDS) {
    const o = document.createElement('option')
    o.textContent = s.label
    speedSel.appendChild(o)
  }
  speedSel.selectedIndex = 2

  let range: { from: number; to: number } | null = null
  let t = 0
  let playing = false
  let lastTick = 0
  let rafId = 0
  let rendering = false

  const layers: Record<string, { playback: boolean; refresh?: () => Promise<void> | void; renderItems: (i: never[]) => void }> = {
    flights: opts.flights,
    military: opts.military,
    earthquakes: opts.quakes,
    gpsjam: opts.gpsjam,
    ...(opts.ships?.enabled ? { ships: opts.ships } : {}),
  }

  async function renderAt(at: number) {
    if (rendering) return // scrub events outrun IndexedDB; drop frames, not correctness
    rendering = true
    try {
      const snaps = await snapshotsAt(at, Object.keys(layers))
      const f = snaps.get('flights')
      if (f) opts.flights.renderItems(f.items as Aircraft[])
      const m = snaps.get('military')
      if (m) opts.military.renderItems(m.items as Aircraft[])
      const q = snaps.get('earthquakes')
      if (q) opts.quakes.renderItems(q.items as Quake[])
      const sh = snaps.get('ships')
      if (sh && opts.ships) opts.ships.renderItems(sh.items as Ship[])
      const j = snaps.get('gpsjam')
      if (j) opts.gpsjam.renderItems(j.items as never[])
      opts.sats.playbackTime = new Date(at)
      opts.sats.repropagate()
      readout.textContent = new Date(at).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
    } finally {
      rendering = false
    }
  }

  function tick(now: number) {
    if (!playing || !range) return
    const mult = SPEEDS[speedSel.selectedIndex].mult
    t = Math.min(t + (now - lastTick) * mult, range.to)
    lastTick = now
    slider.value = String(t)
    void renderAt(t)
    if (t >= range.to) {
      playing = false
      play.textContent = '▶'
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  toggle.onclick = async () => {
    const entering = !document.body.classList.contains('playback')
    if (entering) {
      range = await recordedRange()
      if (!range || range.to - range.from < 5_000) {
        opts.onStatus('NO RECORDED DATA YET — LEAVE THE TAB OPEN TO RECORD')
        return
      }
      document.body.classList.add('playback')
      toggle.textContent = 'LIVE ●'
      bar.classList.add('open')
      for (const l of Object.values(layers)) l.playback = true
      slider.min = String(range.from)
      slider.max = String(range.to)
      t = range.from
      slider.value = slider.min
      await renderAt(t)
    } else {
      document.body.classList.remove('playback')
      toggle.textContent = 'PLAYBACK ⏱'
      bar.classList.remove('open')
      playing = false
      play.textContent = '▶'
      cancelAnimationFrame(rafId)
      for (const l of Object.values(layers)) {
        l.playback = false
        void l.refresh?.() // snap back to live (ships resume via their own render interval)
      }
      opts.sats.playbackTime = null
      opts.sats.repropagate()
      opts.onStatus('')
    }
  }

  play.onclick = () => {
    if (!range) return
    playing = !playing
    play.textContent = playing ? '⏸' : '▶'
    if (playing) {
      if (t >= range.to) t = range.from
      lastTick = performance.now()
      rafId = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafId)
    }
  }

  slider.oninput = () => {
    t = Number(slider.value)
    void renderAt(t)
  }
}
