import { useState, FormEvent } from 'react';
import { useChildren } from '../hooks/useChildren';
import { useAttendance } from '../hooks/useAttendance';
import { isValidDateFormat, isValidRange } from '../lib/dates';
import type { DateRange } from '../api/types';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import ErrorWithRetry from '../components/ErrorWithRetry';

/**
 * AttendancePage — attendance history view.
 *
 * - Child selector dropdown populated via useChildren hook
 * - Start/end date inputs with client-side validation
 * - Displays attendance records sorted by date descending
 * - Empty state, error+retry, retains selections on failure
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export default function AttendancePage() {
  const { state: childrenState } = useChildren();

  // Form state
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Validation errors
  const [startDateError, setStartDateError] = useState<string>('');
  const [endDateError, setEndDateError] = useState<string>('');

  // Submitted query (drives useAttendance)
  const [submittedPersonId, setSubmittedPersonId] = useState<string | null>(null);
  const [submittedRange, setSubmittedRange] = useState<DateRange | null>(null);

  const { state: attendanceState, retry } = useAttendance(submittedPersonId, submittedRange);

  function validateAndSubmit(e: FormEvent) {
    e.preventDefault();

    // Clear previous errors
    setStartDateError('');
    setEndDateError('');

    let hasError = false;

    // Validate start date format (Req 4.4)
    if (!startDate) {
      setStartDateError('Start date is required');
      hasError = true;
    } else if (!isValidDateFormat(startDate)) {
      setStartDateError('Start date must be in YYYY-MM-DD format');
      hasError = true;
    }

    // Validate end date format (Req 4.4)
    if (!endDate) {
      setEndDateError('End date is required');
      hasError = true;
    } else if (!isValidDateFormat(endDate)) {
      setEndDateError('End date must be in YYYY-MM-DD format');
      hasError = true;
    }

    // If both dates are valid format, check range (Req 4.6)
    if (!hasError) {
      const range: DateRange = { start_date: startDate, end_date: endDate };
      if (!isValidRange(range)) {
        setEndDateError('End date must not be earlier than start date');
        hasError = true;
      }
    }

    if (hasError) {
      return;
    }

    // Set query to trigger useAttendance fetch (Req 4.1, 4.2)
    setSubmittedPersonId(selectedChildId);
    setSubmittedRange({ start_date: startDate, end_date: endDate });
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Attendance History</h1>

      <form onSubmit={validateAndSubmit} noValidate>
        {/* Child selector (Req 4.1) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="child-select" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Child
          </label>
          {childrenState.status === 'loading' && <p>Loading children...</p>}
          {childrenState.status === 'error' && <p style={{ color: '#dc2626' }}>Could not load children</p>}
          {childrenState.status === 'empty' && <p>No children linked to your account.</p>}
          {childrenState.status === 'success' && (
            <select
              id="child-select"
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            >
              <option value="">Select a child</option>
              {childrenState.data.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Start date input (Req 4.2, 4.4) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="start-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (startDateError) setStartDateError('');
            }}
            aria-invalid={!!startDateError}
            aria-describedby={startDateError ? 'start-date-error' : undefined}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: startDateError ? '1px solid #dc2626' : '1px solid #d1d5db',
            }}
          />
          {startDateError && (
            <p id="start-date-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {startDateError}
            </p>
          )}
        </div>

        {/* End date input (Req 4.2, 4.6) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="end-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (endDateError) setEndDateError('');
            }}
            aria-invalid={!!endDateError}
            aria-describedby={endDateError ? 'end-date-error' : undefined}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: endDateError ? '1px solid #dc2626' : '1px solid #d1d5db',
            }}
          />
          {endDateError && (
            <p id="end-date-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {endDateError}
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!selectedChildId}
          style={{
            minWidth: '44px',
            minHeight: '44px',
            padding: '0.5rem 1.5rem',
            backgroundColor: selectedChildId ? '#3b82f6' : '#93c5fd',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            cursor: selectedChildId ? 'pointer' : 'not-allowed',
            width: '100%',
          }}
        >
          View Attendance
        </button>
      </form>

      {/* Results section */}
      {submittedPersonId && submittedRange && (
        <div style={{ marginTop: '1.5rem' }}>
          {attendanceState.status === 'loading' && <LoadingIndicator />}

          {attendanceState.status === 'empty' && (
            <EmptyState message={`No attendance records found for the selected date range.`} />
          )}

          {attendanceState.status === 'error' && (
            <ErrorWithRetry
              message={attendanceState.message}
              onRetry={retry}
            />
          )}

          {attendanceState.status === 'success' && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {attendanceState.data.map((record) => (
                <li
                  key={record.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{record.date}</span>
                  <span style={{ color: statusColor(record.presence_status) }}>
                    {formatStatus(record.presence_status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Map presence status to a display-friendly string */
function formatStatus(status: string): string {
  switch (status) {
    case 'On_Leave':
      return 'On Leave';
    default:
      return status;
  }
}

/** Map presence status to a color for visual indication */
function statusColor(status: string): string {
  switch (status) {
    case 'Present':
      return '#16a34a';
    case 'Absent':
      return '#dc2626';
    case 'Late':
      return '#d97706';
    case 'On_Leave':
      return '#6366f1';
    default:
      return '#64748b';
  }
}
