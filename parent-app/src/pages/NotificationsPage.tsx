import { useNotifications } from '../hooks/useNotifications';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import ErrorWithRetry from '../components/ErrorWithRetry';

/**
 * NotificationsPage — displays notifications with title, body, and effective date.
 * Supports load-more pagination (page size 20) and retains previously loaded
 * notifications on error.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export default function NotificationsPage() {
  const { state, notifications, hasMore, loadMore, retry } = useNotifications();

  // Format an ISO timestamp to a readable date string
  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Initial loading — no data yet
  if (state.status === 'loading' && notifications.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Notifications</h1>
        <LoadingIndicator />
      </div>
    );
  }

  // Empty state — no notifications at all
  if (state.status === 'empty') {
    return (
      <div style={{ padding: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Notifications</h1>
        <EmptyState message="No notifications to display." />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Notifications</h1>

      {/* Notification list — retained even on error (Req 6.6) */}
      {notifications.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {notifications.map((notification) => {
            const effectiveDate = notification.sent_at ?? notification.created_at;
            return (
              <li
                key={notification.id}
                style={{
                  borderBottom: '1px solid #e2e8f0',
                  padding: '1rem 0',
                }}
              >
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem 0' }}>
                  {notification.title}
                </h2>
                <p style={{ margin: '0 0 0.5rem 0', color: '#334155' }}>
                  {notification.body}
                </p>
                <time
                  dateTime={effectiveDate}
                  style={{ fontSize: '0.85rem', color: '#64748b' }}
                >
                  {formatDate(effectiveDate)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      {/* Error with retry — shown alongside retained data */}
      {state.status === 'error' && (
        <ErrorWithRetry message={state.message} onRetry={retry} />
      )}

      {/* Load More button when more pages are available */}
      {hasMore && state.status !== 'error' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={loadMore}
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
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
