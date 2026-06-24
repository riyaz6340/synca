/**
 * Channel priority resolution utility.
 * Sorts communication channels by their priority field (ascending: lower number = higher priority).
 * Used by the notification delivery worker and channel preference endpoints.
 */

export interface CommunicationChannel {
  type: string;
  config: Record<string, unknown>;
  priority: number;
}

/**
 * Resolves the delivery order of communication channels by sorting them
 * in ascending priority order (priority 1 is attempted first).
 *
 * @param channels - Array of communication channel configurations
 * @returns Channels sorted by priority (lowest number first)
 */
export function resolveChannelPriority(
  channels: CommunicationChannel[]
): CommunicationChannel[] {
  if (!Array.isArray(channels) || channels.length === 0) {
    return [];
  }
  return [...channels].sort((a, b) => a.priority - b.priority);
}
