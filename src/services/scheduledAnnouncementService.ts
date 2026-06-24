import db from '../config/database';
import { createNotificationsForStakeholders } from './notificationService';

/**
 * Processes scheduled announcements that are due for publication.
 * Finds all announcements where scheduled_at <= NOW() and published_at IS NULL,
 * publishes them, resolves target stakeholders, and sends notifications.
 *
 * @returns The number of announcements published in this cycle.
 */
export async function processScheduledAnnouncements(): Promise<number> {
  const now = new Date();

  // Find all announcements due for publishing
  const dueAnnouncements = await db('announcements')
    .whereNotNull('scheduled_at')
    .where('scheduled_at', '<=', now)
    .whereNull('published_at')
    .select('*');

  if (dueAnnouncements.length === 0) {
    return 0;
  }

  let publishedCount = 0;

  for (const announcement of dueAnnouncements) {
    try {
      // Set published_at = now
      await db('announcements')
        .where({ id: announcement.id })
        .update({ published_at: now, updated_at: now });

      // Resolve target stakeholders based on target_type
      const targetIds: string[] = Array.isArray(announcement.target_ids)
        ? announcement.target_ids
        : JSON.parse(announcement.target_ids);

      let stakeholderIds: string[] = [];

      if (announcement.target_type === 'Organization') {
        // Get ALL stakeholders in the organization
        const stakeholders = await db('stakeholders')
          .where({ organization_id: announcement.organization_id })
          .select('id');
        stakeholderIds = stakeholders.map((s: { id: string }) => s.id);
      } else if (announcement.target_type === 'Group') {
        // Get stakeholders of persons in the specified groups
        const stakeholders = await db('person_stakeholders')
          .join('person_groups', 'person_stakeholders.person_id', 'person_groups.person_id')
          .whereIn('person_groups.group_id', targetIds)
          .select('person_stakeholders.stakeholder_id')
          .distinct();
        stakeholderIds = stakeholders.map((s: { stakeholder_id: string }) => s.stakeholder_id);
      } else if (announcement.target_type === 'Person') {
        // Get stakeholders of the specified persons
        const stakeholders = await db('person_stakeholders')
          .whereIn('person_id', targetIds)
          .select('stakeholder_id')
          .distinct();
        stakeholderIds = stakeholders.map((s: { stakeholder_id: string }) => s.stakeholder_id);
      }

      // Send notifications to all target stakeholders
      if (stakeholderIds.length > 0) {
        await createNotificationsForStakeholders(
          stakeholderIds,
          announcement.organization_id,
          'announcement',
          announcement.title,
          announcement.body
        );
      }

      publishedCount++;
    } catch (error) {
      console.error(
        `[ScheduledAnnouncements] Failed to publish announcement ${announcement.id}:`,
        error
      );
      // Continue processing remaining announcements
    }
  }

  return publishedCount;
}
