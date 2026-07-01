/**
 * Property-Based Tests for Teacher Roles and Attendance Flow
 *
 * Tests pure logic extracted from the feature's business rules using fast-check.
 * Each property is tagged with its design document property number.
 *
 * Feature: teacher-roles-and-attendance-flow
 * Minimum iterations: 100 per property
 */
import * as fc from 'fast-check';

// ─── Pure logic extracted/replicated for testing ─────────────────────────────

/**
 * The canonical set of valid permissions (mirrors permissionService.ts).
 */
const VALID_PERMISSIONS = [
  'mark_attendance',
  'view_attendance_reports',
  'create_announcements',
  'publish_announcements',
  'manage_holidays',
  'approve_leave_requests',
  'view_leave_requests',
  'manage_students',
  'manage_groups',
] as const;

type Permission = (typeof VALID_PERMISSIONS)[number];

/**
 * Pure computation of effective permissions (set union of template + direct).
 * Mirrors the core logic of getEffectivePermissions without DB calls.
 */
function computeEffectivePermissions(
  templatePermissions: string[],
  directPermissions: string[],
): string[] {
  const permissionSet = new Set<string>();
  for (const p of templatePermissions) permissionSet.add(p);
  for (const p of directPermissions) permissionSet.add(p);
  return Array.from(permissionSet);
}

/**
 * Role template name validation logic (mirrors roleTemplates.ts).
 * Name must be a non-empty string with trimmed length between 1 and 100.
 */
function isValidRoleTemplateName(name: unknown): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 100;
}

/**
 * Sequential attendance ordering logic (mirrors backend sort).
 * Non-null roll numbers ascending first, then null roll numbers sorted
 * alphabetically by name (case-insensitive).
 */
interface AttendanceMember {
  person_id: string;
  name: string;
  roll_number: number | null;
}

function sortMembersForSequentialAttendance(
  members: AttendanceMember[],
): AttendanceMember[] {
  return [...members].sort((a, b) => {
    // Non-null roll_numbers come first
    if (a.roll_number !== null && b.roll_number !== null) {
      return a.roll_number - b.roll_number;
    }
    if (a.roll_number !== null && b.roll_number === null) return -1;
    if (a.roll_number === null && b.roll_number !== null) return 1;
    // Both null: alphabetical by name (case-insensitive)
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Roll number validation (mirrors DB constraint: 1-9999 inclusive).
 */
function isValidRollNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 9999;
}

/**
 * DAU computation: count distinct user_ids with at least one event on a given day.
 * Pure in-memory version of the DB query.
 */
interface ActivityEvent {
  user_id: string;
  timestamp: Date;
}

function computeDAU(events: ActivityEvent[], targetDate: string): number {
  const start = new Date(`${targetDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${targetDate}T23:59:59.999Z`).getTime();

  const uniqueUsers = new Set<string>();
  for (const event of events) {
    const ts = event.timestamp.getTime();
    if (ts >= start && ts <= end) {
      uniqueUsers.add(event.user_id);
    }
  }
  return uniqueUsers.size;
}

/**
 * Analytics date range validation (mirrors superAdmin.ts route logic).
 */
function validateAnalyticsDateRange(
  startDate: string,
  endDate: string,
): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  if (end < start) {
    return {
      valid: false,
      error: 'end date must be greater than or equal to start date',
    };
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays > 365) {
    return { valid: false, error: 'span must not exceed 365 days' };
  }

  return { valid: true };
}

/**
 * Email validation (mirrors teachers.ts EMAIL_REGEX and isValidEmail).
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

/**
 * Password validation (mirrors teachers.ts isValidPassword).
 */
function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8;
}

// ─── Arbitrary generators ────────────────────────────────────────────────────

/** Generate a subset of VALID_PERMISSIONS. */
const permissionSubsetArb = fc.subarray([...VALID_PERMISSIONS], {
  minLength: 0,
  maxLength: VALID_PERMISSIONS.length,
});

/** Generate an attendance member with optional roll_number. */
const attendanceMemberArb = fc.record({
  person_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  roll_number: fc.oneof(
    fc.constant(null),
    fc.integer({ min: 1, max: 9999 }),
  ),
});

/** Generate a YYYY-MM-DD date string within a reasonable range. */
const dateStringArb = fc
  .date({
    min: new Date('2020-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z'),
  })
  .map((d) => d.toISOString().split('T')[0]);

/** Generate a valid email address. */
const validEmailArb = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 1,
      maxLength: 20,
    }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 10,
    }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 2,
      maxLength: 6,
    }),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// ─── Property Tests ──────────────────────────────────────────────────────────

const NUM_RUNS = 100;

describe('Feature: teacher-roles-and-attendance-flow, Property 4: Effective permissions as set union', () => {
  it('getEffectivePermissions returns exactly T ∪ D (deduplicated, no extras, no missing)', () => {
    fc.assert(
      fc.property(
        permissionSubsetArb,
        permissionSubsetArb,
        (templatePerms, directPerms) => {
          const effective = computeEffectivePermissions(templatePerms, directPerms);

          // Expected: set union
          const expectedSet = new Set([...templatePerms, ...directPerms]);

          // No duplicates
          expect(effective.length).toBe(new Set(effective).size);

          // Exact match with expected union
          expect(new Set(effective)).toEqual(expectedSet);

          // Every template permission is present
          for (const p of templatePerms) {
            expect(effective).toContain(p);
          }

          // Every direct permission is present
          for (const p of directPerms) {
            expect(effective).toContain(p);
          }

          // No extras: every effective permission must be in T or D
          for (const p of effective) {
            expect(
              templatePerms.includes(p as Permission) ||
                directPerms.includes(p as Permission),
            ).toBe(true);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 5: Role template name validation', () => {
  it('accepts strings with trimmed length 1-100', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => s.trim().length >= 1 && s.trim().length <= 100,
        ),
        (name) => {
          expect(isValidRoleTemplateName(name)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects empty strings (length 0)', () => {
    expect(isValidRoleTemplateName('')).toBe(false);
    expect(isValidRoleTemplateName('   ')).toBe(false); // whitespace-only
  });

  it('rejects strings with trimmed length > 100', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 300 }).filter(
          (s) => s.trim().length > 100,
        ),
        (name) => {
          expect(isValidRoleTemplateName(name)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects null, undefined, and non-string values', () => {
    expect(isValidRoleTemplateName(null)).toBe(false);
    expect(isValidRoleTemplateName(undefined)).toBe(false);
    expect(isValidRoleTemplateName(42)).toBe(false);
    expect(isValidRoleTemplateName({})).toBe(false);
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 9: Sequential attendance ordering', () => {
  it('places non-null roll_numbers first (ascending), then nulls alphabetically by name', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceMemberArb, { minLength: 0, maxLength: 50 }),
        (members) => {
          const sorted = sortMembersForSequentialAttendance(members);

          // Same length (no members lost or added)
          expect(sorted.length).toBe(members.length);

          // Split into non-null and null groups
          const withRoll = sorted.filter((m) => m.roll_number !== null);
          const withoutRoll = sorted.filter((m) => m.roll_number === null);

          // All non-null come before all null
          if (withRoll.length > 0 && withoutRoll.length > 0) {
            const lastRollIndex = sorted.lastIndexOf(withRoll[withRoll.length - 1]);
            const firstNullIndex = sorted.indexOf(withoutRoll[0]);
            expect(lastRollIndex).toBeLessThan(firstNullIndex);
          }

          // Non-null group is sorted ascending by roll_number
          for (let i = 1; i < withRoll.length; i++) {
            expect(withRoll[i].roll_number!).toBeGreaterThanOrEqual(
              withRoll[i - 1].roll_number!,
            );
          }

          // Null group is sorted alphabetically by name (case-insensitive)
          for (let i = 1; i < withoutRoll.length; i++) {
            const cmp = withoutRoll[i].name
              .toLowerCase()
              .localeCompare(withoutRoll[i - 1].name.toLowerCase());
            expect(cmp).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 15: Roll number validation', () => {
  it('accepts integers in the range 1-9999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (n) => {
        expect(isValidRollNumber(n)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects integers below 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 0 }), (n) => {
        expect(isValidRollNumber(n)).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects integers above 9999', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10000, max: 1000000 }), (n) => {
        expect(isValidRollNumber(n)).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects non-integer values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999, noNaN: true }).filter(
          (n) => !Number.isInteger(n),
        ),
        (n) => {
          expect(isValidRollNumber(n)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 16: Activity metric aggregation (DAU)', () => {
  it('DAU equals count of distinct user_ids with at least one event on the target day', () => {
    fc.assert(
      fc.property(
        dateStringArb,
        fc.array(
          fc.record({
            user_id: fc.stringOf(fc.constantFrom(...'abcdef0123456789'.split('')), {
              minLength: 4,
              maxLength: 8,
            }),
            // Generate timestamps across a 3-day window around the target date
            dayOffset: fc.integer({ min: -1, max: 1 }),
            hour: fc.integer({ min: 0, max: 23 }),
            minute: fc.integer({ min: 0, max: 59 }),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (targetDate, rawEvents) => {
          // Build actual events with computed timestamps
          const events: ActivityEvent[] = rawEvents.map((e) => {
            const base = new Date(`${targetDate}T00:00:00.000Z`);
            base.setUTCDate(base.getUTCDate() + e.dayOffset);
            base.setUTCHours(e.hour, e.minute, 0, 0);
            return { user_id: e.user_id, timestamp: base };
          });

          const dau = computeDAU(events, targetDate);

          // Manually compute expected DAU
          const start = new Date(`${targetDate}T00:00:00.000Z`).getTime();
          const end = new Date(`${targetDate}T23:59:59.999Z`).getTime();
          const usersOnDay = new Set<string>();
          for (const ev of events) {
            const ts = ev.timestamp.getTime();
            if (ts >= start && ts <= end) {
              usersOnDay.add(ev.user_id);
            }
          }

          expect(dau).toBe(usersOnDay.size);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('returns 0 when no events exist on the target day', () => {
    const targetDate = '2024-06-15';
    // All events are on a different day
    const events: ActivityEvent[] = [
      { user_id: 'u1', timestamp: new Date('2024-06-14T12:00:00Z') },
      { user_id: 'u2', timestamp: new Date('2024-06-16T12:00:00Z') },
    ];
    expect(computeDAU(events, targetDate)).toBe(0);
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 19: Analytics date range validation', () => {
  it('rejects ranges where end < start', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2020-01-02T00:00:00Z'),
          max: new Date('2030-12-31T00:00:00Z'),
        }),
        fc.integer({ min: 1, max: 1000 }),
        (endDate, daysBack) => {
          const startDate = new Date(endDate);
          startDate.setUTCDate(startDate.getUTCDate() + daysBack); // start > end
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];

          const result = validateAnalyticsDateRange(startStr, endStr);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('end date must be greater than or equal to start date');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('rejects ranges with span > 365 days', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2020-01-01T00:00:00Z'),
          max: new Date('2025-01-01T00:00:00Z'),
        }),
        fc.integer({ min: 366, max: 1000 }),
        (startDate, daysForward) => {
          const endDate = new Date(startDate);
          endDate.setUTCDate(endDate.getUTCDate() + daysForward);
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];

          const result = validateAnalyticsDateRange(startStr, endStr);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('span must not exceed 365 days');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('accepts valid ranges (end >= start, span <= 365 days)', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date('2020-01-01T00:00:00Z'),
          max: new Date('2030-06-01T00:00:00Z'),
        }),
        fc.integer({ min: 0, max: 365 }),
        (startDate, daysForward) => {
          const endDate = new Date(startDate);
          endDate.setUTCDate(endDate.getUTCDate() + daysForward);
          const startStr = startDate.toISOString().split('T')[0];
          const endStr = endDate.toISOString().split('T')[0];

          const result = validateAnalyticsDateRange(startStr, endStr);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: teacher-roles-and-attendance-flow, Property 21: Email and password validation', () => {
  describe('Email validation', () => {
    it('accepts well-formed emails (local@domain.tld) with length <= 254', () => {
      fc.assert(
        fc.property(validEmailArb, (email) => {
          expect(isValidEmail(email)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it('rejects emails exceeding 254 characters', () => {
      fc.assert(
        fc.property(
          fc
            .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
              minLength: 240,
              maxLength: 240,
            })
            .map((local) => `${local}@example.com`),
          (longEmail) => {
            // These will be > 254 chars total
            expect(longEmail.length).toBeGreaterThan(254);
            expect(isValidEmail(longEmail)).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('rejects emails without @ symbol', () => {
      fc.assert(
        fc.property(
          fc
            .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
              minLength: 3,
              maxLength: 50,
            })
            .filter((s) => !s.includes('@')),
          (noAtEmail) => {
            expect(isValidEmail(noAtEmail)).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('rejects empty strings', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('Password validation', () => {
    it('accepts passwords with length >= 8', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 8, maxLength: 200 }),
          (password) => {
            expect(isValidPassword(password)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('rejects passwords with length < 8', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 7 }),
          (password) => {
            expect(isValidPassword(password)).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('rejects empty string', () => {
      expect(isValidPassword('')).toBe(false);
    });
  });
});
