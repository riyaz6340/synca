import type { PersonWithStatus, DisplayPresenceStatus } from '../api/types';

/**
 * Derives the display presence status for a person.
 * Returns 'Not yet marked' when current_status is null,
 * otherwise returns the presence_status value.
 */
export function toDisplayStatus(person: PersonWithStatus): DisplayPresenceStatus {
  if (person.current_status === null) {
    return 'Not yet marked';
  }
  return person.current_status.presence_status;
}
