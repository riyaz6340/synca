import { useChildren } from '../hooks/useChildren';
import { toDisplayStatus } from '../lib/presence';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import ErrorWithRetry from '../components/ErrorWithRetry';

/**
 * HomePage — displays each child with their name and derived presence status.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export default function HomePage() {
  const { state, retry } = useChildren();

  if (state.status === 'loading') {
    return <LoadingIndicator />;
  }

  if (state.status === 'error') {
    return <ErrorWithRetry message={state.message} onRetry={retry} />;
  }

  if (state.status === 'empty') {
    return <EmptyState message="No children found." />;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Presence</h1>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {state.data.map((child) => {
          const displayStatus = toDisplayStatus(child);
          return (
            <li
              key={child.id}
              style={{
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ fontWeight: 600 }}>{child.name}</div>
              <div style={{ marginTop: '0.25rem', color: statusColor(displayStatus), fontSize: '0.875rem' }}>
                {displayStatus}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Maps a display status to a color for visual distinction. */
function statusColor(status: string): string {
  switch (status) {
    case 'Present':
      return '#16a34a';
    case 'Absent':
      return '#dc2626';
    case 'Late':
      return '#ea580c';
    case 'On_Leave':
      return '#7c3aed';
    case 'Not yet marked':
    default:
      return '#64748b';
  }
}
