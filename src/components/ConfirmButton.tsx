import { useEffect, useState, type ReactNode } from 'react'

/**
 * Two-tap confirmation without a native dialog (some browsers and installed web apps block confirm()).
 * The first tap arms the button and changes its label; a second tap within 3 seconds runs the action.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className,
  ariaLabel,
}: {
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  className?: string
  ariaLabel?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      className={`${className ?? ''} ${armed ? 'armed' : ''}`}
      aria-label={armed ? confirmLabel : ariaLabel}
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  )
}
