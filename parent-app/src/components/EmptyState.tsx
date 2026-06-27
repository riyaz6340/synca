/**
 * Empty state displayed when no data is returned from the backend.
 * Requirements: 8.4
 */
interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = 'No data available.' }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        textAlign: 'center',
        color: '#64748b',
      }}
    >
      <p>{message}</p>
    </div>
  )
}
