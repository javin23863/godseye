// Voice command interface (CAP: voice, repo hero "STOP | LISTENING — Ask or command").
// Web Speech API — Edge/Chrome only, needs mic permission; button reflects availability.
// ponytail: keyword router, not NLU; the M4 LLM upgrade routes free text through a model.

type SR = { new (): SpeechRecognitionLike }
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}

export interface VoiceCommands {
  setLayer(name: string, on: boolean): boolean
  setStyle(name: string): boolean
  goTo(place: string): void
}

export function initVoice(cmds: VoiceCommands, onState: (state: string) => void) {
  const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  const btn = document.getElementById('voice-toggle') as HTMLButtonElement
  if (!Ctor) {
    btn.disabled = true
    btn.textContent = 'VOICE N/A'
    return
  }

  let active = false
  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = false
  rec.lang = 'en-US'

  rec.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript.trim().toLowerCase()
    onState(`HEARD: ${text.toUpperCase()}`)
    handle(text)
  }
  rec.onend = () => {
    if (active) rec.start() // keep listening until STOP
  }
  rec.onerror = (e) => onState(`VOICE ERR: ${e.error.toUpperCase()}`)

  function handle(text: string) {
    const on = /\b(show|enable|turn on)\b/.test(text)
    const off = /\b(hide|disable|turn off)\b/.test(text)
    for (const layer of ['flights', 'military', 'satellites', 'earthquakes', 'boundaries']) {
      if (text.includes(layer) && (on || off)) {
        if (cmds.setLayer(layer, on)) onState(`${layer.toUpperCase()} ${on ? 'ON' : 'OFF'}`)
        return
      }
    }
    for (const style of ['normal', 'crt', 'night vision', 'nvg', 'flir', 'anime', 'noir']) {
      if (text.includes(style)) {
        const mapped = style === 'night vision' ? 'nvg' : style
        if (cmds.setStyle(mapped)) onState(`STYLE ${mapped.toUpperCase()}`)
        return
      }
    }
    const go = text.match(/(?:go to|fly to|take me to)\s+(.+)/)
    if (go) {
      cmds.goTo(go[1])
      onState(`FLYING TO ${go[1].toUpperCase()}`)
    }
  }

  btn.onclick = () => {
    active = !active
    if (active) {
      try {
        rec.start()
        btn.textContent = 'LISTENING ●'
        btn.classList.add('active')
        onState('LISTENING — ASK OR COMMAND')
      } catch {
        active = false
      }
    } else {
      rec.stop()
      btn.textContent = 'VOICE'
      btn.classList.remove('active')
      onState('')
    }
  }
}
