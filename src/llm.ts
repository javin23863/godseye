// LLM seam (M4, CAP-49/NL query): same-origin /feeds/llm -> Ollama cloud
// (minimax-m3:cloud), key injected by the proxy. Degrades to null when absent.

const MODEL = 'minimax-m3:cloud'
let available: boolean | null = null // null = untested

async function chat(system: string, user: string, timeoutMs = 20_000): Promise<string | null> {
  if (available === false) return null
  try {
    const ctl = new AbortController()
    const t = window.setTimeout(() => ctl.abort(), timeoutMs)
    const res = await fetch('/feeds/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctl.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
      }),
    })
    window.clearTimeout(t)
    if (!res.ok) throw new Error(`llm ${res.status}`)
    const body = (await res.json()) as { message?: { content?: string } }
    available = true
    return body.message?.content?.trim() || null
  } catch (e) {
    if (available === null) available = false // first failure = no key/proxy; stop asking
    console.warn('llm unavailable:', e)
    return null
  }
}

/** Five-word-ish HUD summary of the current picture (CAP-49). */
export function llmSummary(context: string): Promise<string | null> {
  return chat(
    'You caption a geospatial intelligence display. Reply with EXACTLY five words, ALL CAPS, no punctuation. Terse military-brief style.',
    context,
  )
}

/** Free-text voice question -> one-line answer. */
export function llmAsk(question: string, context: string): Promise<string | null> {
  return chat(
    `You are GODSEYE, a geospatial OSINT assistant. Answer in ONE short sentence, ALL CAPS. Current display state: ${context}`,
    question,
  )
}
