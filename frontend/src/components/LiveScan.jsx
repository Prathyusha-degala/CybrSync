import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound, Loader2, Lock, LogOut, ShieldCheck, TriangleAlert } from 'lucide-react'
import AppBar from './AppBar.jsx'
import DiscoveryPanel from './DiscoveryPanel.jsx'
import Workspace from './Workspace.jsx'
import { liveSession, workspaceApi } from '../lib/api.js'

const EMPTY_DISCOVERY = {
  csv: '',
  probe: true,
  ldapEnabled: false,
  ldap: { server: '', bindDn: '', password: '', baseDn: '', searchFilter: '' },
}

function LoginGate({ onAuthenticated }) {
  const [form, setForm] = useState({ pvwaUrl: '', authMethod: 'CyberArk', username: '' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await liveSession.logon({ ...form, password })
      onAuthenticated(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setPassword('') // never keep the secret in component state longer than one request
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <form onSubmit={submit} className="card p-8" autoComplete="off">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300"><Lock className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Connect to CyberArk PVWA</h1>
            <p className="text-sm text-slate-400">Credential-gated live operational workspace</p>
          </div>
        </div>
        <label className="label mt-6" htmlFor="pvwa">PVWA URL</label>
        <input id="pvwa" className="input" type="url" required placeholder="https://pvwa.corp.local" value={form.pvwaUrl} onChange={(e) => setForm({ ...form, pvwaUrl: e.target.value })} />
        <label className="label mt-4" htmlFor="method">Authentication method</label>
        <select id="method" className="input" value={form.authMethod} onChange={(e) => setForm({ ...form, authMethod: e.target.value })}>
          {['CyberArk', 'LDAP', 'RADIUS', 'Windows'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="label mt-4" htmlFor="user">Username</label>
        <input id="user" className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" />
        <label className="label mt-4" htmlFor="pw">Password</label>
        <input id="pw" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {error && <p className="mt-4 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Authenticate
        </button>
        <ul className="mt-6 space-y-1.5 text-xs text-slate-500">
          <li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Password is relayed once to PVWA logon and never stored.</li>
          <li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Session token held in server memory only; idle-expires with PVWA logoff.</li>
          <li className="flex gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> HTTPS-only PVWA with TLS 1.3 and strict certificate validation.</li>
        </ul>
      </form>
    </div>
  )
}

export default function LiveScan({ go }) {
  const api = useMemo(() => workspaceApi('live'), [])
  const [session, setSession] = useState(null) // null = checking
  const [discovery, setDiscovery] = useState(EMPTY_DISCOVERY)
  const discoveryRef = useRef(discovery)
  discoveryRef.current = discovery

  useEffect(() => {
    liveSession.status().then(setSession).catch(() => setSession({ authenticated: false }))
  }, [])

  const getDiscovery = useCallback(() => {
    const d = discoveryRef.current
    const ldap = d.ldapEnabled
      ? Object.fromEntries(Object.entries(d.ldap).filter(([, v]) => v !== ''))
      : null
    return { csv: d.csv.trim() || null, probe: d.probe, ldap }
  }, [])

  const logoff = async () => {
    await liveSession.logoff().catch(() => {})
    setDiscovery(EMPTY_DISCOVERY)
    setSession({ authenticated: false })
  }

  const authed = session?.authenticated
  return (
    <div className="animate-fadein">
      <AppBar
        go={go}
        view="scan"
        right={authed && (
          <div className="flex items-center gap-3">
            <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {session.user}</span>
            <button className="btn-ghost btn-xs" onClick={logoff}><LogOut className="h-3.5 w-3.5" /> Disconnect</button>
          </div>
        )}
      />
      {session === null && <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {session && !authed && <LoginGate onAuthenticated={setSession} />}
      {authed && (
        <Workspace
          api={api}
          title="Live Operational Workspace"
          subtitle="Real-time discovery against your network and CyberArk Vault. Onboarding writes to the Vault; CPM actions are simulated."
          getDiscovery={getDiscovery}
          sidePanel={<DiscoveryPanel value={discovery} onChange={setDiscovery} />}
          onAuthLost={() => setSession({ authenticated: false })}
          confirmWrites
        />
      )}
    </div>
  )
}
