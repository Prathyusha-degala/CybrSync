import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Radar, RefreshCw, Search, UploadCloud } from 'lucide-react'
import AccountTable from './AccountTable.jsx'
import BlocklistManager from './BlocklistManager.jsx'
import Terminal from './Terminal.jsx'
import { compilePolicy, evaluate } from '../lib/blocklist.js'

const STATES = ['All', 'Unmanaged', 'Managed', 'Blocklisted']
const DEFAULT_PLATFORMS = { Windows: 'WinServerLocal', Unix: 'UnixSSH', 'Windows Domain': 'WinDomain' }

const now = () => new Date().toLocaleString('en-GB', { hour12: false }).replace(',', '')

export default function Workspace({ api, title, subtitle, getDiscovery, examples = [], autoScan = false, sidePanel, onAuthLost, confirmWrites = false, defaultSafe = '' }) {
  const [accounts, setAccounts] = useState([])
  const [exclusions, setExclusions] = useState('')
  const [stateFilter, setStateFilter] = useState('All')
  const [osFilter, setOsFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [logs, setLogs] = useState([])
  const [scanning, setScanning] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [simBusy, setSimBusy] = useState(false)
  const [safeName, setSafeName] = useState(defaultSafe)
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS)
  const [scannedAt, setScannedAt] = useState(null)

  const log = useCallback((level, msg, code = 'CSYNC-UI') => setLogs((l) => [...l, { ts: now(), level, code, msg }]), [])

  // Real-time governance preview: recompute every row's state as exclusions are typed.
  const policy = useMemo(() => compilePolicy(exclusions), [exclusions])
  const view = useMemo(
    () => accounts.map((a) => {
      const reason = evaluate(policy, a.userName, a.address)
      return { ...a, blockReason: reason, state: reason ? 'Blocklisted' : a.inVault ? 'Managed' : 'Unmanaged' }
    }),
    [accounts, policy],
  )
  const counts = useMemo(() => STATES.reduce((m, s) => ({ ...m, [s]: s === 'All' ? view.length : view.filter((r) => r.state === s).length }), {}), [view])
  const osTypes = useMemo(() => ['All', ...new Set(view.map((r) => r.osType))], [view])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return view.filter((r) =>
      (stateFilter === 'All' || r.state === stateFilter) &&
      (osFilter === 'All' || r.osType === osFilter) &&
      (!q || [r.userName, r.address, r.platformId, r.safeName, r.source].some((f) => (f || '').toLowerCase().includes(q))))
  }, [view, stateFilter, osFilter, search])

  // Blocklisted rows can never stay selected.
  useEffect(() => {
    const blocked = new Set(view.filter((r) => r.state === 'Blocklisted').map((r) => r.id))
    setSelected((s) => ([...s].some((id) => blocked.has(id)) ? new Set([...s].filter((id) => !blocked.has(id))) : s))
  }, [view])

  const selectedRows = view.filter((r) => selected.has(r.id) && r.state !== 'Blocklisted')
  const selUnmanaged = selectedRows.filter((r) => r.state === 'Unmanaged')
  const selManaged = selectedRows.filter((r) => r.state === 'Managed')

  const handleError = (e, what) => {
    log('ERROR', `${what} failed: ${e.message}`)
    if (e.status === 401) onAuthLost?.()
  }

  const runScan = useCallback(async () => {
    setScanning(true)
    log('UI', 'Launching async discovery (outside vault) + vault inventory crawl (inside vault)...')
    try {
      const discovery = getDiscovery ? getDiscovery() : undefined
      const r = await api.scan({ exclusions, ...(discovery ? { discovery } : {}) })
      setAccounts(r.accounts)
      setSelected(new Set())
      setScannedAt(new Date())
      const s = r.summary
      log('OK', `Scan complete: ${s.total} accounts — ${s.Unmanaged} unmanaged, ${s.Managed} managed, ${s.Blocklisted} blocklisted`)
      r.policy.errors.forEach((e) => log('WARN', `Policy: ${e}`))
    } catch (e) {
      handleError(e, 'Scan')
    } finally {
      setScanning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, exclusions, getDiscovery, log])

  const didAutoScan = useRef(false)
  useEffect(() => {
    if (autoScan && !didAutoScan.current) {
      didAutoScan.current = true
      runScan()
    }
  }, [autoScan, runScan])

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = (ids, on) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n })

  const onboard = async () => {
    if (!selUnmanaged.length) return
    if (!safeName.trim()) return log('WARN', 'Target safe name is required for onboarding')
    if (confirmWrites && !window.confirm(`Create ${selUnmanaged.length} account(s) in safe "${safeName}" via POST /API/Accounts?`)) return
    setOnboarding(true)
    log('UI', `Bulk onboarding ${selUnmanaged.length} account(s) into safe '${safeName}' (server re-validates blocklist)...`)
    try {
      const r = await api.onboard({ ids: selUnmanaged.map((a) => a.id), safeName: safeName.trim(), platforms, exclusions })
      r.results.forEach((x) => log(x.ok ? 'OK' : 'ERROR', `${x.userName}@${x.address} [${x.platformId}] ${x.message}`, 'CSYNC-API'))
      r.dropped.forEach((d) => log('WARN', `Dropped ${d.userName || d.id}: ${d.reason}`, 'CSYNC-GOV'))
      setAccounts(r.accounts)
      setSelected(new Set())
      const ok = r.results.filter((x) => x.ok).length
      log('DONE', `Onboarding finished: ${ok} created, ${r.results.length - ok} failed, ${r.dropped.length} dropped`)
    } catch (e) {
      handleError(e, 'Onboarding')
    } finally {
      setOnboarding(false)
    }
  }

  const simulate = async (targets, action) => {
    setSimBusy(true)
    for (const t of targets) {
      try {
        await api.simulate({ id: t.id, action, exclusions }, (ev) => setLogs((l) => [...l, { ...ev, ts: ev.ts || now() }]))
      } catch (e) {
        handleError(e, `Simulation for ${t.userName}`)
      }
    }
    setSimBusy(false)
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {scannedAt && <span className="text-xs text-slate-500">Last scan {scannedAt.toLocaleTimeString()}</span>}
          <button className="btn-primary" onClick={runScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />} {accounts.length ? 'Re-scan' : 'Run Scan'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <BlocklistManager value={exclusions} onChange={setExclusions} policy={policy} examples={examples} />
          {sidePanel}
          <div className="card p-5">
            <div className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-emerald-400" /><h3 className="font-semibold text-white">Conditional Bulk Onboarding</h3></div>
            <label className="label mt-4" htmlFor="safe">Target safe</label>
            <input id="safe" className="input" value={safeName} onChange={(e) => setSafeName(e.target.value)} maxLength={28} placeholder="e.g. Unix-Servers" />
            <p className="label mt-4">Platform mapping by OS</p>
            <div className="space-y-2">
              {Object.keys(platforms).map((os) => (
                <div key={os} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
                  <span className="text-xs text-slate-400">{os}</span>
                  <input className="input py-1.5 font-mono text-xs" value={platforms[os]} onChange={(e) => setPlatforms((p) => ({ ...p, [os]: e.target.value }))} aria-label={`Platform for ${os}`} />
                </div>
              ))}
            </div>
            <button className="btn-primary mt-4 w-full" onClick={onboard} disabled={onboarding || !selUnmanaged.length}>
              {onboarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Onboard {selUnmanaged.length} selected unmanaged
            </button>
            <p className="mt-2 text-xs text-slate-500">Issues POST /API/Accounts per account. Blocklisted assets are dropped by the server even if requested.</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => setStateFilter(s)}
                className={`card p-4 text-left transition ${stateFilter === s ? 'border-emerald-500/60 ring-1 ring-emerald-500/40' : 'hover:border-slate-600'}`}
              >
                <p className="text-xs uppercase tracking-wider text-slate-500">{s === 'All' ? 'All accounts' : s}</p>
                <p className={`mt-1 text-2xl font-bold ${s === 'Blocklisted' ? 'text-rose-300' : s === 'Unmanaged' ? 'text-amber-300' : s === 'Managed' ? 'text-emerald-300' : 'text-white'}`}>{counts[s]}</p>
              </button>
            ))}
          </div>

          <div className="card flex flex-wrap items-center gap-3 p-3">
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-950/60 p-1" role="tablist" aria-label="Filter by state">
              {STATES.map((s) => (
                <button key={s} role="tab" aria-selected={stateFilter === s} onClick={() => setStateFilter(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${stateFilter === s ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
            <select className="input w-auto py-1.5" value={osFilter} onChange={(e) => setOsFilter(e.target.value)} aria-label="Filter by OS type">
              {osTypes.map((o) => <option key={o} value={o}>{o === 'All' ? 'All OS types' : o}</option>)}
            </select>
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input className="input pl-9" placeholder="Search user, address, safe, platform..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost btn-xs whitespace-nowrap" disabled={simBusy || !selManaged.length} onClick={() => simulate(selManaged, 'verify')}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Simulate Verification ({selManaged.length})
              </button>
              <button className="btn-ghost btn-xs whitespace-nowrap" disabled={simBusy || !selManaged.length} onClick={() => simulate(selManaged, 'rotate')}>
                <RefreshCw className="h-3.5 w-3.5" /> Simulate Rotation ({selManaged.length})
              </button>
            </div>
          </div>

          {scanning && !accounts.length ? (
            <div className="card flex h-64 items-center justify-center gap-3 text-slate-400"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> Interrogating network and vault...</div>
          ) : (
            <AccountTable rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onSimulate={simulate} simBusy={simBusy} />
          )}

          <Terminal lines={logs} onClear={() => setLogs([])} running={simBusy || onboarding || scanning} />
        </section>
      </div>
    </div>
  )
}
