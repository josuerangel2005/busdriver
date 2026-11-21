import { describe, expect, it } from 'vitest';

import { canSwitchRole } from '@/lib/roleSwitch';

describe('canSwitchRole', () => {
  it('blocks a driver with an active shift and explains why in Spanish', () => {
    expect(canSwitchRole({ role: 'conductor', shiftActive: true })).toEqual({
      allowed: false,
      reason: 'Finaliza el turno antes de cambiar de rol.',
    });
  });

  it('allows a driver without an active shift', () => {
    expect(canSwitchRole({ role: 'conductor', shiftActive: false })).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it('allows a passenger and a null role', () => {
    expect(canSwitchRole({ role: 'pasajero', shiftActive: false })).toEqual({
      allowed: true,
      reason: null,
    });
    expect(canSwitchRole({ role: null, shiftActive: false })).toEqual({
      allowed: true,
      reason: null,
    });
  });
});
