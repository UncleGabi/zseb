import { dismissToast, useToast } from '../toast'

export function Snackbar() {
  const toast = useToast()
  if (!toast) return null
  return (
    <div className="snackbar" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run()
            dismissToast()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
