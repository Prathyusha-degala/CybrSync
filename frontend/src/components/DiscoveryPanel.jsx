import { FileUp, Network } from 'lucide-react'

const CSV_HINT = 'userName,address,osType\nlocal_admin,web01.corp.local,Windows\ndeploy,app-lnx-03.corp.local,Linux'
const MAX_FILE = 2 * 1024 * 1024

export default function DiscoveryPanel({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const setLdap = (patch) => set({ ldap: { ...value.ldap, ...patch } })

  const loadFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE) return window.alert('CSV must be 2 MB or smaller')
    file.text().then((csv) => set({ csv }))
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2"><Network className="h-5 w-5 text-emerald-400" /><h3 className="font-semibold text-white">Network Discovery (outside vault)</h3></div>

      <div className="mt-4 flex items-center justify-between">
        <label className="label mb-0" htmlFor="csv">Host / account inventory (CSV)</label>
        <label className="btn btn-xs cursor-pointer border border-slate-700 text-slate-300 hover:border-emerald-500">
          <FileUp className="h-3.5 w-3.5" /> Load file
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={loadFile} />
        </label>
      </div>
      <textarea id="csv" className="input mt-1 h-28 font-mono text-xs" placeholder={CSV_HINT} value={value.csv} onChange={(e) => set({ csv: e.target.value })} spellCheck={false} />

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={value.probe} onChange={(e) => set({ probe: e.target.checked })} />
        Async TCP reachability &amp; OS fingerprint probe
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={value.ldapEnabled} onChange={(e) => set({ ldapEnabled: e.target.checked })} />
        Active Directory (LDAPS, read-only)
      </label>
      {value.ldapEnabled && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-800 p-3">
          <input className="input" placeholder="dc01.corp.local" value={value.ldap.server} onChange={(e) => setLdap({ server: e.target.value })} aria-label="LDAP server" />
          <input className="input" placeholder="CN=svc_cybrsync,OU=Svc,DC=corp,DC=local" value={value.ldap.bindDn} onChange={(e) => setLdap({ bindDn: e.target.value })} aria-label="Bind DN" autoComplete="off" />
          <input className="input" type="password" placeholder="Bind password (used once, never stored)" value={value.ldap.password} onChange={(e) => setLdap({ password: e.target.value })} aria-label="Bind password" autoComplete="new-password" />
          <input className="input" placeholder="DC=corp,DC=local" value={value.ldap.baseDn} onChange={(e) => setLdap({ baseDn: e.target.value })} aria-label="Base DN" />
          <input className="input font-mono text-xs" placeholder="(optional) custom LDAP filter" value={value.ldap.searchFilter} onChange={(e) => setLdap({ searchFilter: e.target.value })} aria-label="LDAP filter" />
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">Discovery never sends credentials to hosts. Vault inventory is crawled in parallel on every scan.</p>
    </div>
  )
}
