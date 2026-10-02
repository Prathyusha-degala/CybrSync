import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import AppBar from './AppBar.jsx'
import Workspace from './Workspace.jsx'
import { workspaceApi } from '../lib/api.js'

export default function Sandbox({ go }) {
  const api = useMemo(() => workspaceApi('sandbox'), [])
  const [epoch, setEpoch] = useState(0)

  const reset = async () => {
    await api.reset().catch(() => {})
    setEpoch((e) => e + 1) // remount the workspace with fresh mock data
  }

  return (
    <div className="animate-fadein">
      <AppBar
        go={go}
        view="sandbox"
        right={<button className="btn-ghost btn-xs" onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Reset sandbox</button>}
      />
      <div className="border-b border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20" role="status">
        <p className="mx-auto max-w-[1500px] px-4 py-3 text-center text-sm font-semibold tracking-wide text-amber-200 sm:px-6">
          🛠️ CybrSync ADMIN SANDBOX: Operating on Mock Data. Safe to Test.
        </p>
      </div>
      <Workspace
        key={epoch}
        api={api}
        title="Admin Sandbox Workspace"
        subtitle="Identical engine to the live workspace, backed by a mock vault and network. No credentials, no outbound connections."
        examples={['cio_admin', 'ceo_laptop', '^svc_', 'lnx-0[12]']}
        defaultSafe="SBX-Onboarding"
        autoScan
      />
    </div>
  )
}
