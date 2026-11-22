import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/Button';
import { PassengerStopCard } from '@/components/PassengerStopCard';
import { Placard } from '@/components/Placard';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));
vi.mock('@/components/Icon', () => ({ Icon: 'Icon' }));

// Inspect the real component's host props without loading the native renderer.
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

describe('native accessibility props', () => {
  it.each(['Activar línea', 'Iniciar sesión', 'Ajustar a las calles', 'Iniciar turno'])(
    'preserves the name and clears busy when %s finishes',
    (label) => {
      const onPress = vi.fn();
      expect(Button({ label, onPress, loading: true }).props).toMatchObject({
        accessibilityRole: 'button',
        accessibilityLabel: label,
        accessibilityState: { busy: true, disabled: true },
        disabled: true,
      });
      expect(Button({ label, onPress, loading: false }).props).toMatchObject({
        accessibilityRole: 'button',
        accessibilityLabel: label,
        accessibilityState: { busy: false, disabled: false },
        disabled: false,
      });
      expect(Button({ label, onPress, disabled: true }).props.accessibilityState).toEqual({
        busy: false, disabled: true,
      });
    },
  );

  it('names the favorite stop card and preserves its offline status', () => {
    const card = PassengerStopCard({
      stop: { id: 'stop', nombre: 'Centro', orden: 1, ruta_id: 'route', lat: 7.9, lng: -72.5 },
      favorite: true, offline: true, selected: true, highlight: false, onPress: vi.fn(),
    });
    expect(Placard(card.props).props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Mi paradero, Centro, Sin conexión',
      accessibilityState: { selected: true },
    });
  });
});
