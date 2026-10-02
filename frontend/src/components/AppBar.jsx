import { ArrowLeft } from 'lucide-react'
import Logo from './Logo.jsx'

export default function AppBar({ go, view, right }) {
  const tab = (id, label) => (
    <button
      onClick={() => go(id)}
      className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === id ? 'bg-slate-800 text-emerald-300' : 'text-slate-400 hover:text-white'}`}
    >
      {label}
    </button>
  )
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-xs text-slate-400 hover:text-white" onClick={() => go('landing')} aria-label="Back to landing page">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Logo onClick={() => go('landing')} />
          <nav className="hidden gap-1 rounded-lg border border-slate-800 p-1 sm:flex">
            {tab('scan', 'CyberArk Scan')}
            {tab('sandbox', 'Testing for Admins')}
          </nav>
        </div>
        {right}
      </div>
    </header>
  )
}
