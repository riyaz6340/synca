/**
 * AnnouncementsPage — displays published announcements for the parent's children.
 * Each announcement shows its title, body, and formatted published date.
 * Announcements are displayed most-recent first (sorted by published_at descending).
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useAnnouncements } from '../hooks/useAnnouncements';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import ErrorWithRetry from '../components/ErrorWithRetry';

function formatPublishedDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

export default function AnnouncementsPage() {
  const { state, retry } = useAnnouncements();

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Announcements</h1>

      {state.status === 'loading' && <LoadingIndicator />}

      {state.status === 'empty' && (
        <EmptyState message="No announcements are available." />
      )}

      {state.status === 'error' && (
        <ErrorWithRetry
          message={state.message}
          onRetry={retry}
        />
      )}

      {state.status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {state.data.map((announcement) => (
            <article
              key={announcement.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem 0' }}>
                {announcement.title}
              </h2>
              <p style={{ margin: '0 0 0.75rem 0', color: '#374151', lineHeight: 1.5 }}>
                {announcement.body}
              </p>
              <time
                dateTime={announcement.published_at}
                style={{ fontSize: '0.875rem', color: '#64748b' }}
              >
                {formatPublishedDate(announcement.published_at)}
              </time>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
