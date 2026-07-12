// Track store (CAP-24): reads recorded snapshots for a layer/time-window and stitches them
// into persistent entity tracks via the pure buildTracks core. This is the analytics seam
// (like darkvessel) that pattern-of-life, NL-queries and entity tripwires build on — it owns
// no Cesium, just recorder reads + a small per-window cache.
import { snapshotsInRange } from './recorder'
import { buildTracks } from './track-build.mjs'

export interface Fix {
  lat: number
  lon: number
  at: number
  [k: string]: unknown
}
export interface Track {
  id: string
  fixes: Fix[]
  first: number
  last: number
  count: number
}

export class TrackStore {
  private cache = new Map<string, Track[]>()
  private byId = new Map<string, Track>()

  /** Build (or return cached) tracks for a layer over [fromMs, toMs]. */
  async buildForLayer(layer: string, fromMs: number, toMs: number, idKey = 'id'): Promise<Track[]> {
    const cacheKey = `${layer}|${fromMs}|${toMs}|${idKey}`
    const hit = this.cache.get(cacheKey)
    if (hit) return hit
    const snaps = await snapshotsInRange(layer, fromMs, toMs)
    const tracks = buildTracks(
      snaps.map((s) => ({ at: s.at, items: s.items as object[] })),
      idKey,
    ) as Track[]
    this.cache.set(cacheKey, tracks)
    this.byId.clear()
    for (const t of tracks) this.byId.set(t.id, t) // most-recent build wins lookups
    return tracks
  }

  get(id: string): Track | undefined {
    return this.byId.get(id)
  }

  all(): Track[] {
    return [...this.byId.values()]
  }
}
