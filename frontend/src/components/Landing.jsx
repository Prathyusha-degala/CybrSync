import {
  ArrowRight, Ban, Building2, Cpu, Database, FlaskConical, Filter, KeyRound, Lock, MemoryStick, Network,
  Radar, ScanSearch, ShieldCheck, ShieldHalf, Vault, Workflow,
} from 'lucide-react'
import Logo from './Logo.jsx'
import { HARD_CONTAINS, HARD_EXACT } from '../lib/blocklist.js'

function Nav({ go }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Logo onClick={() => go('landing')} />
        <nav className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
          <a href="#how" className="hover:text-emerald-300">How It Works</a>
          <a href="#security" className="hover:text-emerald-300">Why It Is Secure</a>
        </nav>
        <div className="flex gap-2">
          <button className="btn-ghost hidden sm:inline-flex" onClick={() => go('sandbox')}>Testing for Admins</button>
          <button className="btn-primary" onClick={() => go('scan')}>CyberArk Scan</button>
        </div>
      </div>
    </header>
  )
}

function Hero({ go }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-800">
      <div className="grid-bg absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <div className="mb-6 flex justify-center"><Logo size="text-5xl" /></div>
        <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> The CyberArk Unified Scanner &amp; CPM Simulator
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Enterprise-Grade CyberArk Discovery, Governance &amp;{' '}
          <span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">CPM Simulation</span> Workspace
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-400">
          Bridge the gap between network reality and your Vault with real-time external scanning, internal vault
          compliance checks, and safe lifecycle simulation.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button className="btn-primary px-6 py-3 text-base" onClick={() => go('scan')}>
            <Radar className="h-5 w-5" /> CyberArk Scan <ArrowRight className="h-4 w-4" />
          </button>
          <button className="btn-ghost px-6 py-3 text-base" onClick={() => go('sandbox')}>
            <FlaskConical className="h-5 w-5" /> Testing for Admins
          </button>
        </div>
        <p className="mt-4 text-xs text-slate-500">Sandbox requires zero credentials · Live scan is credential-gated &amp; read-only by default</p>
      </div>
    </section>
  )
}

function Node({ icon: Icon, title, items, accent = false }) {
  return (
    <div className={`card relative p-5 ${accent ? 'border-emerald-500/50 bg-emerald-950/30 shadow-xl shadow-emerald-500/10' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${accent ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-300'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="font-semibold text-white">{title}</h4>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{i}</li>
        ))}
      </ul>
    </div>
  )
}

function Link({ label, vertical = false }) {
  return vertical ? (
    <div className="flex flex-col items-center py-1">
      <div className="flow-line-v h-8 w-0.5 animate-pulse" />
      <span className="my-1 rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">{label}</span>
      <div className="flow-line-v h-8 w-0.5 animate-pulse" />
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center px-1">
      <span className="mb-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-emerald-400">{label}</span>
      <div className="flow-line h-0.5 w-full animate-flow" />
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { n: '01', icon: ScanSearch, title: 'Scan & Interrogate', body: 'Async read-only discovery sweeps AD (LDAPS) and imported host inventories, TCP-fingerprints hosts, and crawls the full Vault inventory via the PVWA REST API in parallel.' },
    { n: '02', icon: Filter, title: 'Govern & Filter', body: 'Every account is correlated (outside vs. inside the Vault) and evaluated against the dual-layer blocklist. Protected identities are tagged "Excluded by Policy" and locked from action.' },
    { n: '03', icon: Vault, title: 'Vault & Simulate', body: 'Bulk-onboard compliant unmanaged accounts with POST /API/Accounts, then dry-run CPM verification and rotation cycles that stream PM.log-style events without touching targets.' },
  ]
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <span className="chip border-slate-700 text-slate-400"><Workflow className="h-3.5 w-3.5" /> Integration boundary</span>
        <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">How It Works</h2>
        <p className="mt-3 text-slate-400">CybrSync sits in the middle — it observes the network, reads the Vault, and simulates the CPM. It never pushes credentials to targets.</p>
      </div>

      {/* Architecture box diagram */}
      <div className="card mt-12 p-4 sm:p-8">
        <div className="mx-auto max-w-sm">
          <Node icon={Building2} title="PAM Engineer · Browser" items={['React SPA · HttpOnly session cookie', 'CSRF header on every mutation']} />
        </div>
        <Link vertical label="HTTPS · TLS 1.3" />
        <div className="grid items-center gap-2 md:grid-cols-[1fr_7rem_1.2fr_7rem_1fr]">
          <Node icon={Network} title="Active Directory & Networks" items={['LDAPS :636 paged search (read-only bind)', 'CSV host/account inventory import', 'TCP connect probe 22/445/3389/5985']} />
          <div className="md:hidden"><Link vertical label="read-only discovery" /></div>
          <div className="hidden md:block"><Link label="read-only" /></div>
          <Node accent icon={Cpu} title="CybrSync Core (FastAPI)" items={['Async discovery orchestrator', 'Correlation engine (outside ↔ inside)', 'Dual-layer governance blocklist', 'In-memory session store · zero persistence']} />
          <div className="md:hidden"><Link vertical label="TLS 1.3 · REST" /></div>
          <div className="hidden md:block"><Link label="TLS 1.3 · REST" /></div>
          <Node icon={Database} title="CyberArk Vault · PVWA API" items={['GET /API/Accounts (inventory crawl)', 'GET /API/Accounts/{id} (metadata)', 'POST /API/Accounts (onboarding)']} />
        </div>
        <Link vertical label="dry-run only · no target writes" />
        <div className="mx-auto max-w-md">
          <Node icon={Workflow} title="CPM Lifecycle Simulator" items={['Simulated verify & rotate cycles', 'PM.log-style event stream (SSE)', 'Never calls /Verify, /Change or /Reconcile']} />
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map(({ n, icon: Icon, title, body }) => (
          <div key={n} className="card group p-6 transition hover:border-emerald-500/40">
            <div className="flex items-center justify-between">
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300 group-hover:bg-emerald-500 group-hover:text-slate-950"><Icon className="h-6 w-6" /></div>
              <span className="font-mono text-3xl font-bold text-slate-800">{n}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Security() {
  const extras = [
    { icon: KeyRound, t: 'Credentials used once', d: 'Passwords go straight to PVWA logon and are never stored; only the session token lives in RAM.' },
    { icon: ShieldHalf, t: 'Server-side enforcement', d: 'The UI previews the policy; the API re-evaluates it on every onboard and simulate call.' },
    { icon: Ban, t: 'Read-only by design', d: 'No password retrieval, no Change/Verify calls, no credentials sent to discovered hosts.' },
  ]
  return (
    <section id="security" className="scroll-mt-20 border-y border-slate-800 bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip border-slate-700 text-slate-400"><Lock className="h-3.5 w-3.5" /> Compliance hub</span>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Why It Is Secure</h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="card p-6">
            <MemoryStick className="h-8 w-8 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold text-white">Zero-Persistence</h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-400/80">In-memory processing</p>
            <p className="mt-3 text-sm text-slate-400">No database, no disk cache, no log of secrets. Sessions are opaque random IDs in HttpOnly SameSite=Strict cookies, idle-expire, and trigger PVWA logoff on expiry, logout or shutdown.</p>
          </div>
          <div className="card p-6">
            <Lock className="h-8 w-8 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold text-white">TLS 1.3 Transport Isolation</h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-400/80">Every hop encrypted</p>
            <p className="mt-3 text-sm text-slate-400">Browser → CybrSync is served TLS 1.3-only. Outbound PVWA and LDAPS connections enforce TLS 1.3 with mandatory certificate verification (custom CA supported, verification can't be disabled).</p>
          </div>
          <div className="card p-6">
            <ShieldCheck className="h-8 w-8 text-emerald-400" />
            <h3 className="mt-4 text-lg font-semibold text-white">Dual-Layer Governance Blocklist</h3>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-emerald-400/80">Architectural guardrails</p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-slate-300">Layer 1 · Hardcoded CyberArk rules</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {HARD_EXACT.map((r) => <span key={r} className="chip border-slate-700 font-mono text-slate-400">{r}</span>)}
                  {HARD_CONTAINS.map((r) => <span key={r} className="chip border-slate-700 font-mono text-slate-400">*{r}*</span>)}
                </div>
              </div>
              <div>
                <p className="text-slate-300">Layer 2 · Custom Corporate VIP Exclusions</p>
                <p className="mt-1 text-slate-400">Comma-separated strings/regex (e.g. <code className="text-emerald-300">cio_admin</code>, <code className="text-emerald-300">ceo_laptop</code>) with ReDoS-safe server evaluation.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {extras.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-3 rounded-xl border border-slate-800 p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div><p className="text-sm font-semibold text-white">{t}</p><p className="mt-1 text-sm text-slate-400">{d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Landing({ go }) {
  return (
    <div className="animate-fadein">
      <Nav go={go} />
      <Hero go={go} />
      <HowItWorks />
      <Security />
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to sync network reality with your Vault?</h2>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button className="btn-primary px-6 py-3" onClick={() => go('scan')}><Radar className="h-5 w-5" /> CyberArk Scan</button>
          <button className="btn-ghost px-6 py-3" onClick={() => go('sandbox')}><FlaskConical className="h-5 w-5" /> Testing for Admins</button>
        </div>
      </section>
      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        CybrSync · Not affiliated with or endorsed by CyberArk Software Ltd. · CPM actions are simulated (dry-run).
      </footer>
    </div>
  )
}
