export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M24 3 42 13.5v21L24 45 6 34.5v-21Z" fill="#022c22" stroke="#10b981" strokeWidth="2.5" />
      <path d="M16 21a8 8 0 0 1 14.5-3.5M32 27a8 8 0 0 1-14.5 3.5" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m31.5 13.5-.5 4.5-4.5-.5M16.5 34.5l.5-4.5 4.5.5" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ size = 'text-xl', onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 focus:outline-none" aria-label="CybrSync home">
      <LogoMark className={size === 'text-xl' ? 'h-8 w-8' : 'h-12 w-12'} />
      <span className={`${size} font-extrabold tracking-tight text-white`}>
        Cybr<span className="text-emerald-400">Sync</span>
      </span>
    </button>
  )
}
