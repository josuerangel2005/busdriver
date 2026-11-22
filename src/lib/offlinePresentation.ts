import type { ConnectionStatus } from '@/stores/connection';

export function passengerStatus(
  connection: ConnectionStatus,
  hasVehicle: boolean,
  stale: boolean,
  serviceLabel = 'En servicio',
): { label: string; tone: 'neutral' | 'success' | 'danger'; banner: string | null } {
  if (connection === 'offline') {
    return {
      label: 'Sin conexión',
      tone: 'danger',
      banner: 'Sin conexión. Mostrando la última información disponible.',
    };
  }
  if (!hasVehicle) return { label: 'Sin unidades', tone: 'neutral', banner: null };
  if (stale) return { label: 'Desactualizado', tone: 'danger', banner: null };
  return { label: serviceLabel, tone: 'success', banner: null };
}

export function shiftStartBlock(connection: ConnectionStatus): string | null {
  return connection === 'offline' ? 'Necesitas conexión para iniciar el turno.' : null;
}
