import { useState, FormEvent } from 'react';
import { useChildren } from '../hooks/useChildren';
import { useLeaveRequests } from '../hooks/useLeaveRequests';
import { validateLeaveSubmit } from '../lib/leave';
import type { LeaveSubmitInput, LeaveStatus } from '../api/types';
import LoadingIndicator from '../components/LoadingIndicator';
import EmptyState from '../components/EmptyState';
import ErrorWithRetry from '../components/ErrorWithRetry';

/**
 * LeaveRequestsPage — leave request submission and tracking view.
 *
 * - Submission form: child selector, start date, end date, reason textarea
 * - Client-side validation with validateLeaveSubmit; inline error messages
 * - On success: confirmation message, clear form, show request as Pending in list
 * - On failure: error message, retain entered values
 * - List existing leave requests with person name, dates, reason, and status
 * - Empty state when no requests exist
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */
export default function LeaveRequestsPage() {
  const { state: childrenState } = useChildren();
  const { state: leaveState, submit, retry } = useLeaveRequests();

  // Form state
  const [personId, setPersonId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // Validation errors (keyed by field)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LeaveSubmitInput, string>>>({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Clear previous messages
    setSubmitError('');
    setConfirmationMessage('');

    const input: LeaveSubmitInput = {
      person_id: personId,
      start_date: startDate,
      end_date: endDate,
      reason,
    };

    // Client-side validation (Req 7.2, 7.3)
    const validation = validateLeaveSubmit(input);
    setFieldErrors(validation.errors);

    if (!validation.ok) {
      return;
    }

    // Submit to API
    setSubmitting(true);
    const result = await submit(input);
    setSubmitting(false);

    if (result.ok) {
      // Success (Req 7.4): confirmation message, clear form
      setConfirmationMessage('Leave request submitted successfully.');
      setPersonId('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setFieldErrors({});
    } else {
      // Failure (Req 7.6): show error, retain entered values
      // The hook returns validation-style errors on API failure
      const errorMsg = result.errors.reason || 'Failed to submit leave request. Please try again.';
      setSubmitError(errorMsg);
    }
  }

  // Resolve person name from children data for display in list
  function getPersonName(personIdValue: string): string {
    if (childrenState.status === 'success') {
      const child = childrenState.data.find((c) => c.id === personIdValue);
      if (child) return child.name;
    }
    return personIdValue;
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Leave Requests</h1>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Confirmation message (Req 7.4) */}
        {confirmationMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#dcfce7',
              color: '#166534',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            {confirmationMessage}
          </div>
        )}

        {/* Submit error (Req 7.6) */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            {submitError}
          </div>
        )}

        {/* Child selector (Req 7.1, 7.3) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="leave-person-select" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Child
          </label>
          {childrenState.status === 'loading' && <p>Loading children...</p>}
          {childrenState.status === 'error' && <p style={{ color: '#dc2626' }}>Could not load children</p>}
          {childrenState.status === 'empty' && <p>No children linked to your account.</p>}
          {childrenState.status === 'success' && (
            <select
              id="leave-person-select"
              value={personId}
              onChange={(e) => {
                setPersonId(e.target.value);
                if (fieldErrors.person_id) {
                  setFieldErrors((prev) => ({ ...prev, person_id: undefined }));
                }
              }}
              aria-invalid={!!fieldErrors.person_id}
              aria-describedby={fieldErrors.person_id ? 'person-id-error' : undefined}
              style={{
                width: '100%',
                padding: '0.5rem',
                fontSize: '1rem',
                borderRadius: '0.375rem',
                border: fieldErrors.person_id ? '1px solid #dc2626' : '1px solid #d1d5db',
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
          {fieldErrors.person_id && (
            <p id="person-id-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.person_id}
            </p>
          )}
        </div>

        {/* Start date (Req 7.1, 7.2) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="leave-start-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Start Date
          </label>
          <input
            id="leave-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (fieldErrors.start_date) {
                setFieldErrors((prev) => ({ ...prev, start_date: undefined }));
              }
            }}
            aria-invalid={!!fieldErrors.start_date}
            aria-describedby={fieldErrors.start_date ? 'start-date-error' : undefined}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: fieldErrors.start_date ? '1px solid #dc2626' : '1px solid #d1d5db',
            }}
          />
          {fieldErrors.start_date && (
            <p id="start-date-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.start_date}
            </p>
          )}
        </div>

        {/* End date (Req 7.1, 7.2) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="leave-end-date" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            End Date
          </label>
          <input
            id="leave-end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              if (fieldErrors.end_date) {
                setFieldErrors((prev) => ({ ...prev, end_date: undefined }));
              }
            }}
            aria-invalid={!!fieldErrors.end_date}
            aria-describedby={fieldErrors.end_date ? 'end-date-error' : undefined}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: fieldErrors.end_date ? '1px solid #dc2626' : '1px solid #d1d5db',
            }}
          />
          {fieldErrors.end_date && (
            <p id="end-date-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.end_date}
            </p>
          )}
        </div>

        {/* Reason textarea (Req 7.1, 7.3) */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="leave-reason" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
            Reason
          </label>
          <textarea
            id="leave-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (fieldErrors.reason) {
                setFieldErrors((prev) => ({ ...prev, reason: undefined }));
              }
            }}
            rows={3}
            aria-invalid={!!fieldErrors.reason}
            aria-describedby={fieldErrors.reason ? 'reason-error' : undefined}
            placeholder="Explain the reason for absence..."
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: fieldErrors.reason ? '1px solid #dc2626' : '1px solid #d1d5db',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          {fieldErrors.reason && (
            <p id="reason-error" role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors.reason}
            </p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            minWidth: '44px',
            minHeight: '44px',
            padding: '0.5rem 1.5rem',
            backgroundColor: submitting ? '#93c5fd' : '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Leave Request'}
        </button>
      </form>

      {/* Leave Requests List (Req 7.5, 7.7, 7.8) */}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Leave Requests</h2>

        {leaveState.status === 'loading' && <LoadingIndicator />}

        {leaveState.status === 'empty' && (
          <EmptyState message="You have no leave requests." />
        )}

        {leaveState.status === 'error' && (
          <ErrorWithRetry
            message={leaveState.message}
            onRetry={retry}
          />
        )}

        {leaveState.status === 'success' && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {leaveState.data.map((request) => (
              <li
                key={request.id}
                style={{
                  padding: '0.75rem',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 500 }}>
                    {request.person_name || getPersonName(request.person_id)}
                  </span>
                  <span style={{ color: leaveStatusColor(request.status), fontWeight: 500, fontSize: '0.875rem' }}>
                    {request.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
                  {request.start_date} — {request.end_date}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                  {request.reason}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Map leave status to a color for visual indication */
function leaveStatusColor(status: LeaveStatus): string {
  switch (status) {
    case 'Pending':
      return '#d97706';
    case 'Approved':
      return '#16a34a';
    case 'Rejected':
      return '#dc2626';
    default:
      return '#64748b';
  }
}
