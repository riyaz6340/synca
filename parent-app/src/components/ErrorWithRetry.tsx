/**
 * Error message with a retry button, displayed when a request fails.
 * Requirements: 8.4, 8.5
 */
interface ErrorWithRetryProps {
  message?: string
  onRetry: () => void
}

export default function ErrorWithRetry({
  message = 'Something went wrong. Please try again.',
  onRetry,
}: ErrorWithRetryProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <p style={{ color: '#dc2626', margin: 0 }}>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          padding: '0.5rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          border: 'none',
          borderRadius: '0.375rem',
          fontSize: '1rem',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}
