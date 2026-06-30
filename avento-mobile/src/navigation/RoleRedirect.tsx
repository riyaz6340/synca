/**
 * RoleRedirect — renders the navigator that actually matches the active role.
 *
 * Each role-based tab navigator runs a render-time guard; when it detects it
 * has been mounted for the wrong role it delegates here, which renders the
 * correct role's navigator (landing on that role's dashboard tab). This is the
 * concrete realization of Requirement 2.5 — "redirect to the role-appropriate
 * dashboard" — and Property 4's isolation guarantee.
 *
 * The matching navigator is resolved with a lazy `require` rather than a static
 * import on purpose: the three tab navigators reference this module, so a
 * static import would create a load-time import cycle. Resolving at render time
 * (after all modules have finished evaluating) sidesteps that entirely.
 *
 * Validates: Requirements 2.5
 */

import type { ComponentType } from 'react';

import type { AppRole } from '@/types/auth';

import { navigatorForRole } from './roleGuard';

export default function RoleRedirect({
  role,
}: {
  role: AppRole | null | undefined;
}): JSX.Element {
  const target = navigatorForRole(role);

  let Navigator: ComponentType;
  switch (target) {
    case 'AdminTabs':
      Navigator = require('./AdminTabNavigator').default as ComponentType;
      break;
    case 'SuperAdminTabs':
      Navigator = require('./SuperAdminTabNavigator').default as ComponentType;
      break;
    case 'ParentTabs':
    default:
      Navigator = require('./ParentTabNavigator').default as ComponentType;
      break;
  }

  return <Navigator />;
}
