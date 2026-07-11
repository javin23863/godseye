// 4D recorder (M3, STK-10 record-first doctrine): every live layer refresh lands a
// timestamped snapshot in IndexedDB; playback replays them on the timeline.
// ponytail: one object store, day-keyed pruning later if quota bites.

export interface Snapshot {
  layer: string
  at: number // epoch ms
  items: unknown[] // layer's normalized records
}

const DB_NAME = 'godseye-recorder'
const STORE = 'snapshots'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { autoIncrement: true })
      store.createIndex('layer-at', ['layer', 'at'])
      store.createIndex('at', 'at')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const dbPromise = openDb()

export async function record(layer: string, items: unknown[]) {
  try {
    const db = await dbPromise
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ layer, at: Date.now(), items } satisfies Snapshot)
  } catch (e) {
    console.warn('record failed:', e) // recording is best-effort; live view never blocks on it
  }
}

/** Time range of recorded data, or null when empty. */
export async function recordedRange(): Promise<{ from: number; to: number } | null> {
  const db = await dbPromise
  return new Promise((resolve) => {
    const idx = db.transaction(STORE).objectStore(STORE).index('at')
    const first = idx.openCursor(null, 'next')
    first.onsuccess = () => {
      const lo = first.result?.value as Snapshot | undefined
      if (!lo) return resolve(null)
      const last = idx.openCursor(null, 'prev')
      last.onsuccess = () => {
        const hi = last.result?.value as Snapshot | undefined
        resolve(hi ? { from: lo.at, to: hi.at } : null)
      }
      last.onerror = () => resolve(null)
    }
    first.onerror = () => resolve(null)
  })
}

/** Latest snapshot per layer at-or-before `at`. */
export async function snapshotsAt(at: number, layers: string[]): Promise<Map<string, Snapshot>> {
  const db = await dbPromise
  const out = new Map<string, Snapshot>()
  await Promise.all(
    layers.map(
      (layer) =>
        new Promise<void>((resolve) => {
          const idx = db.transaction(STORE).objectStore(STORE).index('layer-at')
          const req = idx.openCursor(IDBKeyRange.bound([layer, 0], [layer, at]), 'prev')
          req.onsuccess = () => {
            const snap = req.result?.value as Snapshot | undefined
            if (snap) out.set(layer, snap)
            resolve()
          }
          req.onerror = () => resolve()
        }),
    ),
  )
  return out
}
