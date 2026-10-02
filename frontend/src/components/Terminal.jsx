import { useEffect, useRef } from 'react'
import { Eraser, SquareTerminal } from 'lucide-react'

const COLORS = {
  INFO: 'text-slate-300',
  OK: 'text-emerald-400',
  WARN: 'text-amber-400',
  ERROR: 'text-rose-400',
  DONE: 'text-cyan-300 font-semibold',
  UI: 'text-sky-400',
}

export default function Terminal({ lines, onClear, running }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/70" />
            <span className="h-3 w-3 rounded-full bg-amber-400/70" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
          </span>
          <SquareTerminal className="ml-2 h-4 w-4 text-slate-500" />
          <span className="font-mono text-xs text-slate-400">PM.log <span className="text-slate-600">— simulated CPM event stream</span></span>
          {running && <span className="ml-2 h-2 w-2 animate-ping rounded-full bg-emerald-400" />}
        </div>
        <button className="btn-xs btn text-slate-400 hover:text-white" onClick={onClear} aria-label="Clear log"><Eraser className="h-3.5 w-3.5" /> Clear</button>
      </div>
      <div ref={ref} className="h-72 overflow-auto bg-black/70 p-4 font-mono text-xs leading-relaxed" role="log" aria-live="polite">
        {lines.length === 0 && <p className="text-slate-600"># Waiting for events. Run a scan, onboard accounts, or simulate a CPM cycle.</p>}
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words ${COLORS[l.level] || 'text-slate-300'}`}>
            <span className="text-slate-600">[{l.ts}]</span> <span className="text-slate-500">{(l.code || '').padEnd(10)}</span>{' '}
            <span className="inline-block w-12">{l.level}</span> {l.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
