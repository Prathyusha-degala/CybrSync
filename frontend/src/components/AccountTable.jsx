import { useEffect, useRef } from 'react'
import { Ban, CheckCircle2, CircleDashed, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'

const STATE_STYLE = {
  Unmanaged: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Managed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Blocklisted: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
}

function MasterCheckbox({ checked, indeterminate, disabled, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" className="h-4 w-4 accent-emerald-500" checked={checked} disabled={disabled} onChange={onChange} aria-label="Select all visible eligible accounts" />
  )
}

export default function AccountTable({ rows, selected, onToggle, onToggleAll, onSimulate, simBusy }) {
  const eligible = rows.filter((r) => r.state !== 'Blocklisted')
  const selectedVisible = eligible.filter((r) => selected.has(r.id)).length
  const all = eligible.length > 0 && selectedVisible === eligible.length

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <MasterCheckbox
                  checked={all}
                  indeterminate={selectedVisible > 0 && !all}
                  disabled={eligible.length === 0}
                  onChange={() => onToggleAll(eligible.map((r) => r.id), !all)}
                />
              </th>
              <th className="px-3 py-3">Account</th>
              <th className="px-3 py-3">Address</th>
              <th className="px-3 py-3">OS</th>
              <th className="px-3 py-3">State</th>
              <th className="px-3 py-3">Vault</th>
              <th className="px-3 py-3 text-right">CPM Simulator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No accounts match the current filters.</td></tr>
            )}
            {rows.map((r) => {
              const blocked = r.state === 'Blocklisted'
              const canSim = r.inVault && !blocked
              return (
                <tr key={r.id} className={blocked ? 'bg-rose-950/10 text-slate-500' : 'hover:bg-slate-800/30'}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-30"
                      checked={!blocked && selected.has(r.id)}
                      disabled={blocked}
                      onChange={() => onToggle(r.id)}
                      aria-label={`Select ${r.userName}`}
                      title={blocked ? 'Excluded by Policy — selection permanently disabled' : undefined}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className={`font-mono ${blocked ? 'line-through decoration-rose-500/50' : 'text-slate-100'}`}>{r.userName}</div>
                    <div className="text-[11px] text-slate-500">source: {r.source}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      {r.reachable === false && <span title="Unreachable on management ports"><WifiOff className="h-3.5 w-3.5 text-rose-400" /></span>}
                      {r.address}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.osType}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      <span className={`chip ${STATE_STYLE[r.state]}`}>
                        {r.state === 'Managed' && <CheckCircle2 className="h-3 w-3" />}
                        {r.state === 'Unmanaged' && <CircleDashed className="h-3 w-3" />}
                        {blocked && <Ban className="h-3 w-3" />}
                        {r.state}
                      </span>
                      {blocked && (
                        <span className="chip border-rose-500/60 bg-rose-500/20 text-rose-200" title={r.blockReason}>
                          <ShieldAlert className="h-3 w-3" /> Excluded by Policy
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.inVault ? (
                      <div><div className="text-slate-300">{r.safeName}</div><div className="text-slate-500">{r.platformId}{r.automaticManagement === false && ' · manual'}</div></div>
                    ) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {canSim ? (
                      <div className="inline-flex gap-1.5">
                        <button className="btn btn-xs border border-slate-700 hover:border-emerald-500 hover:text-emerald-300" disabled={simBusy} onClick={() => onSimulate([r], 'verify')}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                        </button>
                        <button className="btn btn-xs border border-slate-700 hover:border-emerald-500 hover:text-emerald-300" disabled={simBusy} onClick={() => onSimulate([r], 'rotate')}>
                          <RefreshCw className="h-3.5 w-3.5" /> Rotate
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">{blocked ? 'locked by policy' : 'onboard first'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
