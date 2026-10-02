// Client-side mirror of backend/app/blocklist.py — used ONLY for real-time preview.
// The FastAPI backend re-evaluates the policy on every onboard/simulate call.

export const HARD_EXACT = ['Master', 'Administrator', 'Batch', 'Auditor']
export const HARD_CONTAINS = ['PasswordManager', 'CPM', 'DR_']
const MAX_PATTERNS = 50
const MAX_PATTERN_LEN = 128

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function compilePolicy(raw) {
  let tokens = (raw || '').split(',').map((t) => t.trim()).filter(Boolean)
  const errors = []
  if (tokens.length > MAX_PATTERNS) {
    errors.push(`Only the first ${MAX_PATTERNS} exclusions are applied`)
    tokens = tokens.slice(0, MAX_PATTERNS)
  }
  const patterns = []
  for (const tok of tokens) {
    if (tok.length > MAX_PATTERN_LEN) {
      errors.push(`Pattern longer than ${MAX_PATTERN_LEN} chars rejected`)
      continue
    }
    try {
      patterns.push({ source: tok, re: new RegExp(tok, 'i') })
    } catch {
      errors.push(`Invalid regex '${tok}' — applied as a literal string`)
      patterns.push({ source: escapeRe(tok), re: new RegExp(escapeRe(tok), 'i') })
    }
  }
  const hard = `^(?:${HARD_EXACT.join('|')})$|${HARD_CONTAINS.join('|')}`
  const custom = patterns.map((p) => `(?:${p.source})`).join('|')
  return { patterns, errors, regex: `(?i)(?:${hard})${custom ? `|${custom}` : ''}` }
}

export function evaluate(policy, userName = '', address = '') {
  const name = userName.trim()
  const lname = name.toLowerCase()
  if (HARD_EXACT.some((n) => n.toLowerCase() === lname)) return `Hardcoded safeguard: reserved account '${name}'`
  const hit = HARD_CONTAINS.find((c) => lname.includes(c.toLowerCase()))
  if (hit) return `Hardcoded safeguard: name contains '${hit}'`
  for (const p of policy.patterns) {
    if ((name && p.re.test(name)) || (address && p.re.test(address))) return `Enterprise exclusion: /${p.source}/`
  }
  return null
}
