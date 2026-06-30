/**
 * Unit tests for the push-notification navigation dispatcher.
 *
 * `navigateToTarget` must translate the flat `{ screen, params }` targets
 * emitted by the push service into the nested route path React Navigation
 * needs, guard against an unmounted container, and fall back to a flat
 * navigate for unmapped screens.
 *
 * Validates: Requirements 22.3
 */

import { navigationRef, navigateToTarget } from './navigationRef';

describe('navigateToTarget', () => {
  let isReadySpy: jest.SpyInstance;
  let navigateSpy: jest.SpyInstance;

  beforeEach(() => {
    isReadySpy = jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
    // `navigate` exists on the ref proxy; stub it so we can assert dispatch.
    navigateSpy = jest
      .spyOn(navigationRef, 'navigate')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    isReadySpy.mockRestore();
    navigateSpy.mockRestore();
  });

  it('routes AttendanceHistory through the nested Parent tab → stack path', () => {
    navigateToTarget({
      screen: 'AttendanceHistory',
      params: { personId: 'p1', personName: 'Ann' },
    });

    expect(navigateSpy).toHaveBeenCalledWith('ParentTabs', {
      screen: 'Attendance',
      params: {
        screen: 'AttendanceHistory',
        params: { personId: 'p1', personName: 'Ann' },
      },
    });
  });

  it('routes AnnouncementDetail through the nested Parent tab → stack path', () => {
    navigateToTarget({
      screen: 'AnnouncementDetail',
      params: { announcementId: 'a1' },
    });

    expect(navigateSpy).toHaveBeenCalledWith('ParentTabs', {
      screen: 'Announcements',
      params: {
        screen: 'AnnouncementDetail',
        params: { announcementId: 'a1' },
      },
    });
  });

  it('falls back to a flat navigate for an unmapped screen', () => {
    navigateToTarget({ screen: 'SomeFutureScreen', params: { id: '7' } });

    expect(navigateSpy).toHaveBeenCalledWith('SomeFutureScreen', { id: '7' });
  });

  it('no-ops when the navigation container is not ready', () => {
    isReadySpy.mockReturnValue(false);

    navigateToTarget({ screen: 'AnnouncementDetail', params: { announcementId: 'a1' } });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
