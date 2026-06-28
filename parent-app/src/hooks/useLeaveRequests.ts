/**
 * Hook: useLeaveRequests
 * Fetches leave requests on mount and provides a submit function that
 * validates input before sending to the API.
 *
 * - Fetches existing leave requests via `leaveApi.list()` on mount
 * - Exposes `submit(input)` that validates with `validateLeaveSubmit` before sending
 * - On valid submission, calls `leaveApi.submit()` and adds the new request to the list
 * - Manages loading/success/empty/error view state with retry support
 *
 * Validates: Requirements 7.1, 7.3, 7.5, 7.6, 7.7, 7.8
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ViewState, LeaveRequest, LeaveSubmitInput } from '../api/types';
import { leaveApi } from '../api/endpoints';
import { validateLeaveSubmit, type LeaveValidationResult } from '../lib/leave';

export interface UseLeaveRequestsReturn {
  state: ViewState<LeaveRequest[]>;
  submit: (input: LeaveSubmitInput) => Promise<LeaveValidationResult>;
  submitResult: LeaveValidationResult | null;
  retry: () => void;
}

export function useLeaveRequests(): UseLeaveRequestsReturn {
  const [state, setState] = useState<ViewState<LeaveRequest[]>>({ status: 'loading' });
  const [submitResult, setSubmitResult] = useState<LeaveValidationResult | null>(null);
  const isMounted = useRef(true);

  const fetchLeaveRequests = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      const response = await leaveApi.list(1);

      if (!isMounted.current) return;

      if (response.data.length === 0) {
        setState({ status: 'empty' });
      } else {
        setState({ status: 'success', data: response.data });
      }
    } catch (error: unknown) {
      if (!isMounted.current) return;

      const message =
        error instanceof Error ? error.message : 'Failed to load leave requests';
      setState({ status: 'error', message });
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchLeaveRequests();

    return () => {
      isMounted.current = false;
    };
  }, [fetchLeaveRequests]);

  const submit = useCallback(
    async (input: LeaveSubmitInput): Promise<LeaveValidationResult> => {
      // Validate input before sending to API
      const validation = validateLeaveSubmit(input);
      setSubmitResult(validation);

      if (!validation.ok) {
        return validation;
      }

      try {
        const newRequest = await leaveApi.submit(input);

        if (!isMounted.current) return validation;

        // On success, add the new request to the list
        setState((prev) => {
          if (prev.status === 'success') {
            return { status: 'success', data: [newRequest, ...prev.data] };
          }
          // If previously empty or in another state, start with the new request
          return { status: 'success', data: [newRequest] };
        });

        return validation;
      } catch (error: unknown) {
        if (!isMounted.current) return validation;

        // On submission failure, report error via validation result
        const message =
          error instanceof Error ? error.message : 'Failed to submit leave request';
        const failureResult: LeaveValidationResult = {
          ok: false,
          errors: { reason: message },
        };
        setSubmitResult(failureResult);
        return failureResult;
      }
    },
    [],
  );

  const retry = useCallback(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  return { state, submit, submitResult, retry };
}
