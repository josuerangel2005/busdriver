export type LatLng = { latitude: number; longitude: number };

export type Sentido = 'ida' | 'vuelta';

export type Ruta = {
  id: string;
  nombre: string;
  linea_id: string;
  linea_nombre: string;
  sentido: Sentido;
  polyline: LatLng[];
};

export type Parada = {
  id: string;
  ruta_id: string;
  nombre: string;
  lat: number;
  lng: number;
  orden: number;
};

export type VehiculoActivo = {
  vehiculo_id: string;
  lat: number;
  lng: number;
  timestamp_ultima_actualizacion: number;
  ruta_activa: string;
  velocidad_actual: number;
  en_servicio: boolean;
};

export type Consentimiento = {
  aceptado: boolean;
  version: string;
  timestamp: number;
};

export type MetricaEspera = {
  id: string;
  parada_id: string;
  inicio: number;
  fin: number;
  duracion_ms: number;
};

export type UserRole = 'conductor' | 'pasajero';
