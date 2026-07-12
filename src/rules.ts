// Rules/conditions engine (CAP-22): register named rules over the live picture (or a recorded
// frame) and fire when their condition goes matched. Evaluation logic is pure — it lives in
// rules-eval.mjs (headless, node --test'able); this thin wrapper owns rule storage, edge-
// triggered debounce, and the fire callback. No cesium/DOM needed, so this stays framework-free.
import { fireEdges } from './rules-eval.mjs'
import type { Condition, EvalContext, EvalResult } from './rules-eval.mjs'

export type { Condition, EvalContext, EvalResult }

export interface Rule {
  id: string
  name: string
  condition: Condition
  /** Optional area-of-interest metadata for the UI (highlight ring); not used by evaluation. */
  aoi?: { lat: number; lon: number; radiusKm: number }
}

export interface FiredRule {
  rule: Rule
  hits: object[]
  at: number
}

export class RuleEngine {
  private rules = new Map<string, Rule>()
  // edge-trigger memory: a rule that STAYS matched must not re-fire until it goes false then
  // true again. Absent id == never matched.
  private lastMatched = new Map<string, boolean>()
  private cb: ((f: FiredRule) => void) | null = null

  add(rule: Rule): void {
    this.rules.set(rule.id, rule)
  }

  remove(id: string): void {
    this.rules.delete(id)
    this.lastMatched.delete(id)
  }

  list(): Rule[] {
    return [...this.rules.values()]
  }

  onFire(cb: (f: FiredRule) => void): void {
    this.cb = cb
  }

  /** Evaluate every rule against ctx; return (and callback) only the rules that fired this pass
   *  — i.e. matched now AND not matched on the previous pass (rising edge). Debounce lives in the
   *  pure fireEdges step; this method just stamps time + invokes the callback. */
  evaluate(ctx: EvalContext): FiredRule[] {
    const at = Date.now()
    const fired = fireEdges(this.rules.values(), ctx, this.lastMatched).map(
      (f): FiredRule => ({ rule: f.rule as Rule, hits: f.hits, at }),
    )
    for (const f of fired) this.cb?.(f)
    return fired
  }
}
