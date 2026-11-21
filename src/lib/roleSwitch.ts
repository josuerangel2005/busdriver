import type { UserRole } from '@/types/models';

export type RoleSwitchCheck = {
  allowed: boolean;
  reason: string | null;
};

/**
 * Decides whether the current session may leave its role.
 *
 * A driver with an active shift must finish it first, otherwise the tracking
 * session would stay orphaned. Every other case is allowed.
 */
export function canSwitchRole(params: {
  role: UserRole | null;
  shiftActive: boolean;
}): RoleSwitchCheck {
  if (params.role === 'conductor' && params.shiftActive) {
    return { allowed: false, reason: 'Finaliza el turno antes de cambiar de rol.' };
  }
  return { allowed: true, reason: null };
}
