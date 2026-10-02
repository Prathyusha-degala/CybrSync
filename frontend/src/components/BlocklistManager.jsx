import { Lock, Plus, ShieldCheck, TriangleAlert } from 'lucide-react'
import { HARD_CONTAINS, HARD_EXACT } from '../lib/blocklist.js'

export default function BlocklistManager({ value, onChange, policy, examples = [] }) {
  // onChange is a React state setter, so use the updater form to avoid stale values on rapid clicks.
  const add = (tok) =>
    onChange((prev) => {
      const cur = prev.split(',').map((t) => t.trim()).filter(Boolean)
      return cur.includes(tok) ? prev : [...cur, tok].join(', ')
    })
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold text-white">Dynamic Compliance Blocklist</h3>
      </div>

      <p className="label mt-4">Layer 1 · Hardcoded CyberArk safeguards (immutable)</p>
      <div className="flex flex-wrap gap-1.5" aria-label="Hardcoded safeguards">
        {HARD_EXACT.map((r) => (
          <span key={r} className="chip cursor-not-allowed select-none border-slate-700 bg-slate-800/60 font-mono text-slate-500" title="Exact match · cannot be removed">
            <Lock className="h-3 w-3" /> {r}
          </span>
        ))}
        {HARD_CONTAINS.map((r) => (
          <span key={r} className="chip cursor-not-allowed select-none border-slate-700 bg-slate-800/60 font-mono text-slate-500" title="Contains match · cannot be removed">
            <Lock className="h-3 w-3" /> contains “{r}”
          </span>
        ))}
      </div>

      <label className="label mt-5" htmlFor="exclusions">Layer 2 · Enterprise Exclusions (comma-separated strings / regex)</label>
      <input
        id="exclusions"
        className="input font-mono"
        placeholder="cio_admin, ceo_laptop, ^svc_exec_\d+$"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      {examples.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          Try:
          {examples.map((ex) => (
            <button key={ex} type="button" onClick={() => add(ex)} className="chip border-emerald-500/30 font-mono text-emerald-300 hover:bg-emerald-500/10">
              <Plus className="h-3 w-3" /> {ex}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">Matched case-insensitively against account user name <em>and</em> address. Re-enforced server-side on every action.</p>

      <p className="label mt-4">Effective compiled policy (live)</p>
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-800 bg-black/50 p-3 font-mono text-xs text-emerald-300">{policy.regex}</pre>
      {policy.errors.map((e) => (
        <p key={e} className="mt-2 flex items-center gap-1.5 text-xs text-amber-400"><TriangleAlert className="h-3.5 w-3.5" /> {e}</p>
      ))}
    </div>
  )
}
