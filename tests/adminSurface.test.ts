import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { mockRepository } from '@/services/mockRepository';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('admin entry points', () => {
  it('authorizes only the demo admin in the mock repository', async () => {
    await expect(mockRepository.isAdmin('mock-admin')).resolves.toBe(true);
    await expect(mockRepository.isAdmin('mock-driver')).resolves.toBe(false);
  });

  it('keeps the driver and passenger actions and adds a secondary admin action', () => {
    const home = read('../src/app/index.tsx');
    expect(home).toContain('label="Soy conductor"');
    expect(home).toContain('label="Soy pasajero"');
    expect(home).toContain('Soy administrador');
    expect(home).toContain("router.push('/admin/login')");
  });

  it('lists both active and inactive catalog routes with direction and a sign-out action', () => {
    const landing = read('../src/app/admin/index.tsx');
    for (const text of ['Administración', 'catalog.routes', 'linea_id', 'sentido', 'activa', 'Cerrar sesión', 'Redirect']) {
      expect(landing).toContain(text);
    }
  });

  it('uses accessible native credential inputs and mock-only demo instructions', () => {
    const login = read('../src/app/admin/login.tsx');
    for (const text of ['keyboardType="email-address"', 'autoComplete="email"', 'autoComplete="current-password"', 'secureTextEntry', 'minHeight: 48', 'USE_MOCK &&']) {
      expect(login).toContain(text);
    }
  });
});

describe('admin rules structure (no emulator)', () => {
  const { rules } = JSON.parse(read('../firebase/database.rules.json'));

  it('keeps the allowlist self-readable and not client-writable', () => {
    expect(rules.admins['.write']).toBe(false);
    expect(rules.admins.$uid['.read']).toBe('auth != null && auth.uid === $uid');
    expect(rules.admins['.read']).not.toBeTruthy();
    expect(rules['.write']).toBe(false);
  });

  it.each([['rutas', '$rutaId'], ['paradas', '$paradaId']])('protects %s writes without blocking authenticated reads', (collection, id) => {
    expect(rules[collection]['.read']).toBe('auth != null');
    expect(rules[collection]['.write']).not.toBeTruthy();
    expect(rules[collection][id]['.write']).toBe(
      "auth != null && root.child('admins').child(auth.uid).val() === true && auth.token.firebase.sign_in_provider === 'password'"
        + (collection === 'rutas' ? ' && newData.exists()' : ''),
    );
  });

  it('validates route fields and checks stop references against the post-write tree', () => {
    const route = rules.rutas.$rutaId;
    const stop = rules.paradas.$paradaId;
    expect(route['.validate']).toContain("hasChildren(['nombre', 'linea_id', 'linea_nombre', 'sentido', 'polyline'])");
    expect(route.nombre['.validate']).toMatch(/isString\(\).*>= 1.*<= 120/);
    expect(route.linea_id['.validate']).toMatch(/isString\(\).*length > 0/);
    expect(route.linea_nombre['.validate']).toMatch(/isString\(\).*length > 0/);
    expect(route.sentido['.validate']).toMatch(/'ida'.*'vuelta'/);
    expect(route.polyline['.validate']).toBe('newData.hasChildren()');
    expect(route.activa['.validate']).toBe('newData.isBoolean()');
    expect(stop['.validate']).toContain("hasChildren(['ruta_id', 'nombre', 'lat', 'lng', 'orden'])");
    expect(stop['.validate']).toContain("newData.parent().parent().child('rutas').child(newData.child('ruta_id').val()).exists()");
    expect(stop.ruta_id['.validate']).toBe("newData.isString()");
    expect(stop.nombre['.validate']).toMatch(/isString\(\).*>= 1.*<= 80/);
    expect(stop.lat['.validate']).toMatch(/isNumber\(\).*>= -90.*<= 90/);
    expect(stop.lng['.validate']).toMatch(/isNumber\(\).*>= -180.*<= 180/);
    expect(stop.orden['.validate']).toMatch(/isNumber\(\).*>= 1/);
  });
});

it('exposes list CRUD actions and an authenticated editor with both map modes', () => {
  const landing = read('../src/app/admin/index.tsx');
  const editor = read('../src/app/admin/line/[lineaId].tsx');
  expect(landing).not.toContain('Podrás editar las rutas en una próxima versión.');
  for (const label of ['Nueva línea', 'Editar', 'Desactivar línea', 'Activar línea', 'Alert.alert', 'Badge']) {
    expect(landing).toContain(label);
  }
  for (const label of ['Nombre de la línea', 'Trazado', 'Paraderos', 'Rehacer trazado', 'Deshacer', 'Ajustar a las calles', 'Guardar', 'Redirect']) {
    expect(editor).toContain(label);
  }
});

it('restricts catalog field sets, validates point bounds, and accepts the bundled seed shape', () => {
  const { rules } = JSON.parse(read('../firebase/database.rules.json'));
  const { rutas, paradas } = JSON.parse(read('../firebase/seed.json'));
  const route = rules.rutas.$rutaId;
  const stop = rules.paradas.$paradaId;
  const allowed = (rule: Record<string, unknown>) => Object.keys(rule).filter((key) => !/^[.$]/.test(key)).sort();
  const checkKeys = (data: object, rule: Record<string, unknown>) => {
    expect(rule.$other).toEqual({ '.validate': false });
    expect(Object.keys(data).every((key) => allowed(rule).includes(key))).toBe(true);
  };
  expect(allowed(route)).toEqual(['activa', 'linea_id', 'linea_nombre', 'nombre', 'polyline', 'sentido', 'waypoints']);
  expect(allowed(stop)).toEqual(['lat', 'lng', 'nombre', 'orden', 'ruta_id']);
  for (const path of ['polyline', 'waypoints']) {
    const point = route[path].$i;
    expect(allowed(point)).toEqual(['latitude', 'longitude']);
    expect(point['.validate']).toContain("hasChildren(['latitude', 'longitude'])");
    expect(point.latitude['.validate']).toMatch(/isNumber\(\).*>= -90.*<= 90/);
    expect(point.longitude['.validate']).toMatch(/isNumber\(\).*>= -180.*<= 180/);
    expect(point.$other).toEqual({ '.validate': false });
  }
  for (const record of Object.values(rutas) as { nombre: string; linea_id: string; linea_nombre: string; sentido: string; polyline: { latitude: number; longitude: number }[] }[]) {
    checkKeys(record, route);
    expect(record.nombre.length).toBeGreaterThan(0);
    expect(record.nombre.length).toBeLessThanOrEqual(120);
    expect(record.linea_id).not.toBe('');
    expect(record.linea_nombre).not.toBe('');
    expect(['ida', 'vuelta']).toContain(record.sentido);
    expect(record.polyline.length).toBeGreaterThan(0);
    for (const point of record.polyline) {
      checkKeys(point, route.polyline.$i);
      expect(Math.abs(point.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(point.longitude)).toBeLessThanOrEqual(180);
    }
  }
  for (const record of Object.values(paradas) as { nombre: string; ruta_id: string; lat: number; lng: number; orden: number }[]) {
    checkKeys(record, stop);
    expect(record.nombre.length).toBeGreaterThan(0);
    expect(record.nombre.length).toBeLessThanOrEqual(80);
    expect(rutas[record.ruta_id]).toBeDefined();
    expect(Math.abs(record.lat)).toBeLessThanOrEqual(90);
    expect(Math.abs(record.lng)).toBeLessThanOrEqual(180);
    expect(record.orden).toBeGreaterThanOrEqual(1);
  }
});

it('blocks saving and line ID allocation before the remote catalog is loaded', () => {
  const editor = read('../src/app/admin/line/[lineaId].tsx');
  expect(editor).toMatch(/const waitingForCatalog = catalog\.source !== 'remote'/);
  expect(editor).toMatch(/async function save\(\) \{\s*if \(waitingForCatalog[^\n]+return;[\s\S]*?const id = lineId \?\? lineIdFor/);
  expect(editor).toMatch(/label="Guardar"[^\n]+disabled=\{[^}]+waitingForCatalog[^}]*\}/);
  expect(editor).toContain('Esperando las rutas del servidor para guardar sin perder datos…');
  expect(editor).toMatch(/key=\{[^\n]*catalog\.source/);
});
