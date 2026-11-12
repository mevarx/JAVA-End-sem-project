/**
 * HAES brand mark. The H bars carry an ECG pulse instead of a plain crossbar,
 * so the mark reads as "hospital" and "live operations" at the same time.
 */
export function Logo({
  size = 32,
  className = '',
  onDark = false,
}: {
  size?: number
  className?: string
  onDark?: boolean
}) {
  const fill = onDark ? 'var(--color-panel-accent)' : 'var(--color-accent)'
  const mark = onDark ? 'var(--color-panel)' : 'var(--color-on-accent)'
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="HAES"
      style={{ width: size, height: size }}
    >
      <rect x="2" y="2" width="60" height="60" rx="16" fill={fill} />
      <rect
        x="2.75"
        y="2.75"
        width="58.5"
        height="58.5"
        rx="15.25"
        fill="none"
        stroke={mark}
        strokeOpacity="0.14"
        strokeWidth="1.5"
      />
      <path
        d="M20 16.5v31M44 16.5v31"
        stroke={mark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M20 32h6.5l2.8-6.4 4.9 12.6 3-6.2H44"
        fill="none"
        stroke={mark}
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col leading-none">
      <span className="font-display text-[1.35rem] font-semibold tracking-[-0.04em] text-ink">
        HAES
      </span>
      {!compact && (
        <span className="mt-1 truncate text-[0.58rem] font-medium uppercase tracking-[0.18em] text-muted">
          Health operations
        </span>
      )}
    </span>
  )
}
