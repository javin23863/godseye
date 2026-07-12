// SAVED BOARDS panel (the collaboration unit): name a view, SAVE it (camera + which layers are
// on), and get back a list where each board can LOAD (fly + re-toggle layers), COPY a share-link,
// or delete. Persisted to localStorage "godseye-boards". Same {activeLayers, applyLayers} contract
// as the share module so main.ts reuses one SHAREABLE map. Pure array/codec math is in
// boards-core.mjs; this file is only the cesium/DOM/localStorage seam.
import type { Viewer } from 'cesium'
import { addBoard, deserializeBoards, removeBoard, serializeBoards } from './boards-core.mjs'
import { applyState, captureState, stateToHash } from './scene-state'
import { shareUrl } from './share-core.mjs'

export interface BoardsOpts {
  /** names of the layers currently toggled on (main.ts owns the name<->layer mapping). */
  activeLayers(): string[]
  /** turn exactly the named layers on and the rest off. */
  applyLayers(names: string[]): void
  viewer: Viewer
}

const KEY = 'godseye-boards'

/** Wire the BOARDS panel: self-injects a section into #panel and restores saved boards. */
export function init(opts: BoardsOpts): void {
  const status = document.getElementById('status')
  const say = (t: string) => status && (status.textContent = t)

  injectStyle()
  const section = document.createElement('section')
  section.id = 'boards'
  section.innerHTML = `
    <h2>SAVED BOARDS</h2>
    <div id="boards-new">
      <input id="board-name" type="text" placeholder="name this view…" maxlength="40" />
      <button id="board-save">SAVE</button>
    </div>
    <div id="boards-list"></div>`
  document.getElementById('panel')!.appendChild(section)

  const nameEl = section.querySelector<HTMLInputElement>('#board-name')!
  const listEl = section.querySelector<HTMLDivElement>('#boards-list')!

  const load = () => deserializeBoards(localStorage.getItem(KEY))
  const store = (boards: ReturnType<typeof load>) => localStorage.setItem(KEY, serializeBoards(boards))

  const save = () => {
    const name = nameEl.value.trim()
    if (!name) return say('BOARD NAME REQUIRED')
    const state = captureState(opts.viewer, { layers: opts.activeLayers() })
    store(addBoard(load(), name, state))
    nameEl.value = ''
    render()
    say(`BOARD "${name}" SAVED`)
  }
  section.querySelector<HTMLButtonElement>('#board-save')!.onclick = save
  // block form, not `e.key === 'Enter' && save()`: a DOM0 handler returning false
  // (every non-Enter key) is preventDefault — it silently swallows all typing.
  nameEl.onkeydown = (e) => {
    if (e.key === 'Enter') save()
  }

  function render() {
    const boards = load()
    listEl.innerHTML = ''
    if (!boards.length) {
      listEl.innerHTML = `<div class="boards-empty">NO SAVED BOARDS</div>`
      return
    }
    for (const b of boards) {
      const row = document.createElement('div')
      row.className = 'board-row'

      const name = document.createElement('button')
      name.className = 'board-load'
      name.textContent = b.name
      name.title = 'load this view'
      name.onclick = () => {
        const extras = applyState(opts.viewer, b.state) // flies the camera
        if (extras.layers) opts.applyLayers(extras.layers)
        say(`BOARD "${b.name}" LOADED`)
      }

      const link = document.createElement('button')
      link.className = 'board-link'
      link.textContent = '🔗'
      link.title = 'copy share link'
      link.onclick = async () => {
        const hash = stateToHash(b.state)
        location.hash = hash
        try {
          await navigator.clipboard.writeText(shareUrl(location.href, hash))
          say(`"${b.name}" LINK COPIED`)
        } catch {
          say(`"${b.name}" LINK IN ADDRESS BAR`) // clipboard blocked (no https/denied) — URL bar has it
        }
      }

      const del = document.createElement('button')
      del.className = 'board-del'
      del.textContent = '✕'
      del.title = 'delete'
      del.onclick = () => {
        store(removeBoard(load(), b.name))
        render()
        say(`BOARD "${b.name}" DELETED`)
      }

      row.append(name, link, del)
      listEl.appendChild(row)
    }
  }

  render()
}

// ponytail: one injected <style> instead of editing style.css (off-limits); #panel's own CSS
// already styles the section h2/buttons, this only lays out the input row + list rows.
function injectStyle() {
  if (document.getElementById('boards-style')) return
  const s = document.createElement('style')
  s.id = 'boards-style'
  s.textContent = `
    #boards-new { display: flex; gap: 4px; margin-bottom: 6px; }
    #board-name {
      flex: 1; min-width: 0; background: rgba(0,0,0,0.4); border: 1px solid #37474f;
      color: #cfd8dc; font: inherit; font-size: 11px; padding: 3px 6px; letter-spacing: 1px;
    }
    #board-name:focus { outline: none; border-color: #4fc3f7; }
    #board-save { flex: 0 0 auto; color: #ffab40 !important; }
    .boards-empty { color: #455a64; font-size: 9px; letter-spacing: 2px; padding: 4px 0; }
    .board-row { display: flex; align-items: center; gap: 4px; }
    .board-load {
      flex: 1; min-width: 0; text-align: left !important; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; color: #4fc3f7 !important;
    }
    .board-link, .board-del { flex: 0 0 auto; padding: 2px 6px !important; }
    .board-del:hover { color: #ff8a80 !important; }`
  document.head.appendChild(s)
}
