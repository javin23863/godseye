// Live SIGINT news ticker, docked left of the globe (mirrors analyst.ts's self-injecting
// #panel siblings): two keyless feeds — GDELT DOC 2.0 (conflict/markets query, last hour) and
// Google News world RSS — normalized + deduped + corroborated by newsfeed-core.mjs, rendered as
// a scrollable, filterable row list. Click a row -> onSelect(item); this module never navigates
// or opens tabs itself, the orchestrator (main.ts) owns geocode/fly-to.
import { normalizeGdeltDoc, normalizeRss, mergeAndCorroborate, ageLabel, type NewsItem } from './newsfeed-core.mjs'

const GDELT_FEED = '/feeds/newsdoc' // proxied -> api.gdeltproject.org/api/v2/doc/doc?… ('gdeltdoc' would be prefix-shadowed by /feeds/gdelt)
const RSS_FEED = '/feeds/rssnews' // proxied -> news.google.com/rss?hl=en-US&gl=US&ceid=US:en
const POLL_MS = 90_000

type Category = 'ALL' | 'NEWS' | 'CONFLICT' | 'CLIMATE' | 'DISASTER'
type SourceFilter = 'ALL' | 'GDELT' | 'RSS'
export type MergedItem = ReturnType<typeof mergeAndCorroborate>[number]

const CHIP_COLOR: Record<string, string> = { CONFIRMED: '#69f0ae', LIKELY: '#ffb74d', PLAUSIBLE: '#546e7a' }
const CAT_COLOR: Record<string, string> = { CONFLICT: '#ff5252', DISASTER: '#ff8a80', CLIMATE: '#4fc3f7', NEWS: '#78909c' }

const STYLE = `
#newsfeed {
  position: absolute; top: 80px; left: 220px; width: 300px; max-height: calc(100vh - 160px);
  background: rgba(8, 14, 18, 0.82); border: 1px solid #263238; border-radius: 6px;
  padding: 8px 10px; font-size: 10px; letter-spacing: 1px; color: #cfd8dc;
  display: flex; flex-direction: column; z-index: 5;
}
#newsfeed-head { display: flex; justify-content: space-between; align-items: center; }
#newsfeed h3 { font-size: 10px; letter-spacing: 3px; color: #78909c; margin: 0; }
#newsfeed-live {
  font: inherit; font-size: 9px; letter-spacing: 2px; color: #78909c;
  background: none; border: 1px solid #263238; border-radius: 3px; padding: 2px 6px; cursor: pointer;
}
#newsfeed-live.active { color: #ff5252; border-color: #ff5252; }
#newsfeed-filters { display: flex; flex-wrap: wrap; gap: 3px; margin: 6px 0; }
#newsfeed-filters button {
  font: inherit; font-size: 9px; color: #cfd8dc; background: none;
  border: 1px solid #263238; border-radius: 3px; padding: 2px 5px; cursor: pointer;
}
#newsfeed-filters button.active { color: #4fc3f7; border-color: #4fc3f7; }
#newsfeed-rows { overflow-y: auto; flex: 1; min-height: 40px; scrollbar-width: thin; scrollbar-color: #263238 transparent; }
#newsfeed-empty { color: #546e7a; font-size: 9px; padding: 6px 0; text-align: center; }
.newsfeed-row {
  display: flex; align-items: stretch; gap: 6px; width: 100%; text-align: left;
  background: none; border: none; border-bottom: 1px solid #1a2327; padding: 5px 0; cursor: pointer;
}
.newsfeed-row:hover { background: rgba(79, 195, 247, 0.08); }
.newsfeed-bar { width: 3px; border-radius: 2px; flex-shrink: 0; }
.newsfeed-body { flex: 1; min-width: 0; }
.newsfeed-title { color: #fff; font-size: 10px; line-height: 1.3; }
.newsfeed-meta { display: flex; gap: 6px; margin-top: 3px; font-size: 8px; letter-spacing: 1px; color: #546e7a; }
.newsfeed-chip { font-weight: 600; }
.newsfeed-domain { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body.clean-ui #newsfeed { display: none; }
`

export class NewsFeedPanel {
  private panel: HTMLDivElement
  private rows: HTMLDivElement
  private liveBtn: HTMLButtonElement
  private _items: MergedItem[] = []
  private category: Category = 'ALL'
  private sourceFilter: SourceFilter = 'ALL'
  private live = false
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false

  constructor(private onSelect: (item: MergedItem) => void) {
    if (!document.getElementById('newsfeed-style')) {
      const style = document.createElement('style')
      style.id = 'newsfeed-style'
      style.textContent = STYLE
      document.head.appendChild(style)
    }

    this.panel = document.createElement('div')
    this.panel.id = 'newsfeed'
    this.panel.innerHTML = `
      <div id="newsfeed-head">
        <h3>// NEWS FEED</h3>
        <button id="newsfeed-live" title="poll every 90s">LIVE</button>
      </div>
      <div id="newsfeed-filters">
        <span data-group="cat">
          <button data-cat="ALL" class="active">ALL</button>
          <button data-cat="NEWS">NEWS</button>
          <button data-cat="CONFLICT">CONFLICT</button>
          <button data-cat="CLIMATE">CLIMATE</button>
          <button data-cat="DISASTER">DISASTER</button>
        </span>
        <span data-group="src">
          <button data-src="ALL" class="active">ALL</button>
          <button data-src="GDELT">GDELT</button>
          <button data-src="RSS">RSS</button>
        </span>
      </div>
      <div id="newsfeed-rows"><div id="newsfeed-empty">NO ITEMS YET &middot; TOGGLE LIVE</div></div>
    `
    document.body.appendChild(this.panel)

    this.rows = this.panel.querySelector<HTMLDivElement>('#newsfeed-rows')!
    this.liveBtn = this.panel.querySelector<HTMLButtonElement>('#newsfeed-live')!
    this.liveBtn.onclick = () => (this.live ? this.stop() : this.start())

    this.panel.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((btn) => {
      btn.onclick = () => {
        this.category = btn.dataset.cat as Category
        this.panel.querySelectorAll('[data-cat]').forEach((b) => b.classList.toggle('active', b === btn))
        this.render()
      }
    })
    this.panel.querySelectorAll<HTMLButtonElement>('[data-src]').forEach((btn) => {
      btn.onclick = () => {
        this.sourceFilter = btn.dataset.src as SourceFilter
        this.panel.querySelectorAll('[data-src]').forEach((b) => b.classList.toggle('active', b === btn))
        this.render()
      }
    })
  }

  get items(): MergedItem[] {
    return this._items
  }

  /** Turn on 90s polling (fetches immediately, then every POLL_MS); off cancels the interval. */
  start(): void {
    this.live = true
    this.liveBtn.classList.add('active')
    void this.refresh()
    this.timer = setInterval(() => void this.refresh(), POLL_MS)
  }

  stop(): void {
    this.live = false
    this.liveBtn.classList.remove('active')
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** One fetch cycle over both feeds. Each renders as soon as IT lands — GDELT slow-walks
   *  rate-limited responses (>10s observed), and the fast feed must not wait on the slow one. */
  async refresh(): Promise<void> {
    if (this.busy) return
    this.busy = true
    const ingest = (items: NewsItem[]) => {
      if (!items.length) return
      this._items = mergeAndCorroborate(this._items, items)
      this.render()
    }
    try {
      await Promise.allSettled([this.fetchGdelt().then(ingest), this.fetchRss().then(ingest)])
      if (!this._items.length) this.render() // both empty -> honest empty state
    } finally {
      this.busy = false
    }
  }

  private async fetchGdelt(): Promise<NewsItem[]> {
    try {
      const res = await fetch(GDELT_FEED, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`gdelt ${res.status}`)
      return normalizeGdeltDoc(await res.json())
    } catch (err) {
      console.warn('newsfeed: GDELT unavailable:', err)
      return []
    }
  }

  private async fetchRss(): Promise<NewsItem[]> {
    try {
      const res = await fetch(RSS_FEED, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`rss ${res.status}`)
      return normalizeRss(await res.text(), 'GOOGLE-NEWS')
    } catch (err) {
      console.warn('newsfeed: RSS unavailable:', err)
      return []
    }
  }

  private render(): void {
    this.panel.dataset.items = String(this._items.length) // verify/devtools hook
    const now = Date.now()
    const shown = this.items.filter(
      (it) =>
        (this.category === 'ALL' || it.category === this.category) &&
        (this.sourceFilter === 'ALL' || it.source === this.sourceFilter),
    )
    this.rows.innerHTML = ''
    if (!shown.length) {
      const empty = document.createElement('div')
      empty.id = 'newsfeed-empty'
      empty.textContent = this.items.length ? 'NOTHING MATCHES THESE FILTERS' : 'NO ITEMS YET · TOGGLE LIVE'
      this.rows.appendChild(empty)
      return
    }
    for (const it of shown) {
      const row = document.createElement('button')
      row.className = 'newsfeed-row'

      const bar = document.createElement('span')
      bar.className = 'newsfeed-bar'
      bar.style.background = CAT_COLOR[it.category] ?? CAT_COLOR.NEWS

      const body = document.createElement('span')
      body.className = 'newsfeed-body'
      const title = document.createElement('span')
      title.className = 'newsfeed-title'
      title.textContent = it.title // untrusted feed text -> textContent, never innerHTML
      const meta = document.createElement('span')
      meta.className = 'newsfeed-meta'
      const chip = document.createElement('span')
      chip.className = 'newsfeed-chip'
      chip.style.color = CHIP_COLOR[it.chip] ?? CHIP_COLOR.PLAUSIBLE
      chip.textContent = `[${it.chip}]`
      const domain = document.createElement('span')
      domain.className = 'newsfeed-domain'
      domain.textContent = it.domain
      const age = document.createElement('span')
      age.textContent = ageLabel(it.ts, now)
      meta.append(chip, domain, age)
      body.append(title, meta)

      row.append(bar, body)
      row.onclick = () => this.onSelect(it)
      this.rows.appendChild(row)
    }
  }

  setVisible(v: boolean): void {
    this.panel.style.display = v ? '' : 'none'
  }

  destroy(): void {
    this.stop()
    this.panel.remove()
    document.getElementById('newsfeed-style')?.remove()
  }
}
