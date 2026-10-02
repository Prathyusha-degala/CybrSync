import { useEffect, useState } from 'react'
import Landing from './components/Landing.jsx'
import LiveScan from './components/LiveScan.jsx'
import Sandbox from './components/Sandbox.jsx'

// Hash routing keeps the SPA deployable as static files and makes Back work.
const VIEWS = { '#/scan': 'scan', '#/sandbox': 'sandbox' }
const readView = () => VIEWS[window.location.hash] || 'landing'

export default function App() {
  const [view, setView] = useState(readView)

  useEffect(() => {
    const onHash = () => setView(readView())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v) => {
    window.location.hash = v === 'landing' ? '' : `#/${v}`
    setView(v)
    window.scrollTo({ top: 0 })
  }

  if (view === 'scan') return <LiveScan go={go} />
  if (view === 'sandbox') return <Sandbox go={go} />
  return <Landing go={go} />
}
