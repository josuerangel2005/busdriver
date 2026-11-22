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
      "auth != null && root.child('admins').child(auth.uid).val() === true && auth.token.firebase.sign_in_provider === 'password'",
    );
  });

  it('validates route fields and checks stop references against the post-write tree', () => {
    const route = rules.rutas.$rutaId;
    const stop = rules.paradas.$paradaId;
    expect(route['.validate']).toContain("hasChildren(['nombre', 'linea_id', 'linea_nombre', 'sentido', 'polyline'])");
    expect(route.nombre['.validate']).toMatch(/isString\(\).*>= 1.*<= 120/);
    expect(route.linea_id['.validate']).toBe('newData.isString()');
    expect(route.linea_nombre['.validate']).toBe('newData.isString()');
    expect(route.sentido['.validate']).toMatch(/'ida'.*'vuelta'/);
    expect(route.polyline['.validate']).toBe('newData.hasChildren()');
    expect(route.activa['.validate']).toBe('newData.isBoolean()');
    expect(stop['.validate']).toContain("hasChildren(['ruta_id', 'nombre', 'lat', 'lng', 'orden'])");
    expect(stop['.validate']).toContain("newData.parent().parent().child('rutas').child(newData.child('ruta_id').val()).exists()");
    expect(stop.ruta_id['.validate']).toBe("newData.isString()");
    expect(stop.nombre['.validate']).toBe('newData.isString()');
    expect(stop.lat['.validate']).toMatch(/isNumber\(\).*>= -90.*<= 90/);
    expect(stop.lng['.validate']).toMatch(/isNumber\(\).*>= -180.*<= 180/);
    expect(stop.orden['.validate']).toMatch(/isNumber\(\).*>= 1/);
  });
});
