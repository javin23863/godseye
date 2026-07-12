// AI-as-analyst (M4/M5 payoff): turns the globe into a copilot. "WHAT NEEDS ATTENTION" ranks the
// live analytics candidates (fusion composites, dark vessels, big quakes, densest mil cluster,
// jam cells) with the pure heuristic scorer and surfaces the top-3 as clickable chips — keyless.
// When an LLM key is live it also (a) hangs a one-line rationale on each chip and (b) powers the
// #nlq box: a plain phrase -> STRICT JSON filter -> the layer's recorded items narrowed by
// applyGeoFilter -> temporary q- markers framed on the globe. Ranking + filtering are headless
// (analyst-core.mjs); this file is only DOM + cesium + LLM wiring. Self-injects #analyst.
import { Cartesian2, Cartesian3, Color, CustomDataSource, Rectangle, Viewer } from 'cesium'
import { rankAttention, applyGeoFilter } from './analyst-core.mjs'
import { snapshotsInRange } from './recorder'
import { llmAsk } from './llm'

export interface Candidate {
  kind: string
  lat: number
  lon: number
  score: number
  text: string
}

interface AnalystOpts {
  /** Flat candidate list drawn from the live analytics layers (assembled in main.ts). */
  candidates: () => Candidate[]
  viewer: Viewer
}

interface Query {
  layer?: string
  center?: { lat: number; lon: number }
  radiusKm?: number
  timeWindowH?: number
  minValue?: number
  valueKey?: string
}

const DEFAULT_WINDOW_H = 6
// NL layer names -> recorder layer keys (recorder stores 'earthquakes'/'ships'/'military'/…).
// ponytail: tiny alias map, grow it if the layer roster grows.
const LAYER_ALIAS: Record<string, string> = {
  quake: 'earthquakes',
  quakes: 'earthquakes',
  seismic: 'earthquakes',
  earthquake: 'earthquakes',
  earthquakes: 'earthquakes',
  ship: 'ships',
  ships: 'ships',
  vessel: 'ships',
  vessels: 'ships',
  mil: 'military',
  military: 'military',
  aircraft: 'flights',
  flight: 'flights',
  flights: 'flights',
  plane: 'flights',
  planes: 'flights',
  gpsjam: 'gpsjam',
  jamming: 'gpsjam',
  jam: 'gpsjam',
}

export function init(opts: AnalystOpts) {
  const { viewer } = opts
  const status = document.getElementById('status')!
  const setStatus = (t: string) => (status.textContent = t)

  // temporary NL-query markers (q- prefix); cleared and repainted on each query
  const ds = new CustomDataSource('analyst-q')
  void viewer.dataSources.add(ds)

  // -- panel (self-injected, mirrors #pol-panel / #oil-panel) --------------
  const panel = document.createElement('div')
  panel.id = 'analyst'
  panel.innerHTML = `
    <h3>AI ANALYST</h3>
    <button id="attention-run">WHAT NEEDS ATTENTION</button>
    <div id="attention"></div>
    <input id="nlq" type="search" placeholder="ask the globe…" />`
  document.body.appendChild(panel)

  const runBtn = panel.querySelector<HTMLButtonElement>('#attention-run')!
  const chips = panel.querySelector<HTMLDivElement>('#attention')!
  const nlq = panel.querySelector<HTMLInputElement>('#nlq')!

  // -- (A) WHAT NEEDS ATTENTION -------------------------------------------
  runBtn.onclick = () => {
    const top = rankAttention(opts.candidates()).slice(0, 3)
    chips.innerHTML = ''
    if (!top.length) {
      chips.textContent = 'NOTHING FLAGGED YET · RUN A SCAN'
      return
    }
    top.forEach((c) => {
      const chip = document.createElement('button')
      chip.className = 'attention-chip'
      // c.text embeds untrusted feed data (AIS ship names) — build with text nodes, not innerHTML.
      const kind = document.createElement('b')
      kind.textContent = c.kind.toUpperCase()
      const small = document.createElement('small')
      chip.append(kind, document.createTextNode(' ' + c.text), small)
      chip.onclick = () =>
        viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(c.lon, c.lat, 120_000) })
      chips.appendChild(chip)
      // rationale is an upgrade, not a requirement — llmAsk returns falsy with no key, chip stays.
      void addRationale(c, small)
    })
  }

  async function addRationale(c: Candidate, slot: HTMLElement) {
    const line = await llmAsk(
      `In one short line, why is this worth an analyst's attention: ${c.text}`,
      `${c.kind} at ${c.lat.toFixed(2)},${c.lon.toFixed(2)}, priority score ${c.score}`,
    )
    if (line) slot.textContent = line
  }

  // -- (B) natural-language query -----------------------------------------
  nlq.onkeydown = async (e) => {
    if (e.key !== 'Enter' || !nlq.value.trim()) return
    const phrase = nlq.value.trim()
    setStatus('AI QUERY: TRANSLATING…')
    const q = await translate(phrase)
    if (!q || !q.layer) {
      setStatus('AI QUERY NEEDS A KEY / REPHRASE')
      return
    }
    const layer = LAYER_ALIAS[q.layer.toLowerCase()] ?? q.layer.toLowerCase()
    const items = await pullItems(layer, q.timeWindowH)
    const matches = applyGeoFilter(items, {
      center: q.center,
      radiusKm: q.radiusKm,
      minValue: q.minValue,
      valueKey: q.valueKey,
    }) as { lat: number; lon: number }[]
    drawMatches(matches)
    setStatus(`${matches.length} MATCHES`)
    frame(matches)
  }

  /** Ask the LLM to translate the phrase to a STRICT JSON filter; parse defensively. Returns
   *  null with no key or when nothing JSON-shaped comes back (caller -> "NEEDS A KEY / REPHRASE"). */
  async function translate(phrase: string): Promise<Query | null> {
    const raw = await llmAsk(
      `Translate to STRICT JSON only (no prose) with keys layer, center{lat,lon}, radiusKm, ` +
        `timeWindowH, minValue, valueKey. Omit unknown keys. Query: ${phrase}`,
      'Output JSON only.',
    )
    if (!raw) return null
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return normalizeKeys(JSON.parse(m[0])) as Query
    } catch {
      return null
    }
  }

  /** Latest recorded frame for the layer over the query's time window (default 6h). ponytail:
   *  the newest frame is the current picture for a geo query — stitch history via TrackStore only
   *  once a query actually needs a track, not for a point-in-time "what's in this radius" ask. */
  async function pullItems(layer: string, windowH?: number): Promise<Record<string, unknown>[]> {
    const h = windowH && windowH > 0 ? windowH : DEFAULT_WINDOW_H
    const now = Date.now()
    const snaps = await snapshotsInRange(layer, now - h * 3_600_000, now)
    return (snaps.at(-1)?.items as Record<string, unknown>[]) ?? []
  }

  function drawMatches(matches: { lat: number; lon: number }[]) {
    ds.entities.suspendEvents()
    ds.entities.removeAll()
    matches.forEach((it, i) => {
      if (!Number.isFinite(it.lat) || !Number.isFinite(it.lon)) return
      ds.entities.add({
        id: `q-${i}`,
        position: Cartesian3.fromDegrees(it.lon, it.lat),
        point: {
          pixelSize: 9,
          color: Color.fromCssColorString('#4fc3f7').withAlpha(0.85),
          outlineColor: Color.fromCssColorString('#ffab40'),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `⌖ Q${i + 1}`,
          font: '10px Consolas, monospace',
          fillColor: Color.fromCssColorString('#4fc3f7'),
          pixelOffset: new Cartesian2(9, -9),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    })
    ds.entities.resumeEvents()
  }

  /** Frame the match set: fly to a single hit, or fit the bbox of many. */
  function frame(matches: { lat: number; lon: number }[]) {
    const pts = matches.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon))
    if (!pts.length) return
    if (pts.length === 1) {
      viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(pts[0].lon, pts[0].lat, 120_000) })
      return
    }
    const lons = pts.map((p) => p.lon)
    const lats = pts.map((p) => p.lat)
    viewer.camera.flyTo({
      destination: Rectangle.fromDegrees(
        Math.min(...lons) - 0.5,
        Math.min(...lats) - 0.5,
        Math.max(...lons) + 0.5,
        Math.max(...lats) + 0.5,
      ),
    })
  }
}

// Case-insensitive lookup to canonical Query keys, so an ALL-CAPS or lowercased LLM reply
// ({"RADIUSKM":50} / {"radiuskm":50}) still lands on the camelCase field we read.
const CANON: Record<string, keyof Query> = {
  layer: 'layer',
  center: 'center',
  radiuskm: 'radiusKm',
  timewindowh: 'timeWindowH',
  minvalue: 'minValue',
  valuekey: 'valueKey',
}

/** Remap an LLM reply's keys onto canonical Query keys (and center onto lat/lon). */
function normalizeKeys(obj: Record<string, unknown>): Query {
  const q: Query = {}
  for (const k in obj) {
    const canon = CANON[k.toLowerCase()]
    if (canon) (q as Record<string, unknown>)[canon] = obj[k]
  }
  if (q.center && typeof q.center === 'object') {
    const c = q.center as Record<string, unknown>
    q.center = {
      lat: Number(c.lat ?? c.LAT ?? c.Lat),
      lon: Number(c.lon ?? c.LON ?? c.Lon ?? c.lng ?? c.LNG),
    }
  }
  return q
}
