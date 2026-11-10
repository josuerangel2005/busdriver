import { PILOT_ROUTE_ID } from '@/constants/config';
import type { Parada, Ruta } from '@/types/models';

export const PLACEHOLDER_ROUTE: Ruta = {
  id: PILOT_ROUTE_ID,
  nombre: 'Ruta Piloto (placeholder)',
  polyline: [
    { latitude: 7.9215, longitude: -72.498 },
    { latitude: 7.918, longitude: -72.4983 },
    { latitude: 7.914, longitude: -72.4987 },
    { latitude: 7.91, longitude: -72.4995 },
    { latitude: 7.906, longitude: -72.5 },
    { latitude: 7.902, longitude: -72.5004 },
    { latitude: 7.898, longitude: -72.5008 },
    { latitude: 7.894, longitude: -72.5012 },
    { latitude: 7.89, longitude: -72.5016 },
    { latitude: 7.886, longitude: -72.5022 },
    { latitude: 7.882, longitude: -72.5026 },
    { latitude: 7.878, longitude: -72.5032 },
    { latitude: 7.874, longitude: -72.5038 },
  ],
};

export const PLACEHOLDER_PARADAS: Parada[] = [
  {
    id: 'parada-01',
    ruta_id: PILOT_ROUTE_ID,
    nombre: 'Terminal de Transportes',
    lat: 7.9215,
    lng: -72.498,
    orden: 1,
  },
  {
    id: 'parada-02',
    ruta_id: PILOT_ROUTE_ID,
    nombre: 'Av. 0 con Calle 10',
    lat: 7.91,
    lng: -72.4995,
    orden: 2,
  },
  {
    id: 'parada-03',
    ruta_id: PILOT_ROUTE_ID,
    nombre: 'Parque Colón',
    lat: 7.898,
    lng: -72.5008,
    orden: 3,
  },
  {
    id: 'parada-04',
    ruta_id: PILOT_ROUTE_ID,
    nombre: 'Av. 0 con Calle 5',
    lat: 7.886,
    lng: -72.5022,
    orden: 4,
  },
  {
    id: 'parada-05',
    ruta_id: PILOT_ROUTE_ID,
    nombre: 'La Libertad',
    lat: 7.874,
    lng: -72.5038,
    orden: 5,
  },
];
