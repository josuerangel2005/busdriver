import { readFileSync } from 'node:fs';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const projectId = 'demo-buseta-ya';
const adminUid = 'test-admin';
const route = {
  nombre: 'Test route',
  linea_id: 'test-line',
  linea_nombre: 'Test line',
  sentido: 'ida',
  polyline: [{ latitude: 4.6, longitude: -74.1 }],
  activa: true,
};
const stop = { ruta_id: 'r', nombre: 'Test stop', lat: 4.6, lng: -74.1, orden: 1 };

let env: RulesTestEnvironment;

function db(uid: string, provider: 'password' | 'anonymous' = 'password') {
  return env.authenticatedContext(uid, { firebase: { sign_in_provider: provider } }).database();
}

async function seed(data: object) {
  await env.withSecurityRulesDisabled(async (context) => {
    await context.database().ref().set(data);
  });
}

beforeAll(async () => {
  const address = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9400';
  const { hostname, port } = new URL(`http://${address}`);
  if (!['127.0.0.1', 'localhost'].includes(hostname) || !port) {
    throw new Error('Database rules tests require a loopback emulator host and port.');
  }
  env = await initializeTestEnvironment({
    projectId,
    database: {
      host: hostname,
      port: Number(port),
      rules: readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await env.clearDatabase();
});

afterAll(async () => {
  await env?.cleanup();
});

describe('catalog and admin rules', () => {
  it.each(['anonymous', 'password'] as const)('denies catalog writes and self-promotion for a non-admin %s token', async (provider) => {
    await seed({ rutas: { r: route } });
    const user = db('rider', provider);

    await assertFails(user.ref('rutas/r').set(route));
    await assertFails(user.ref('paradas/p').set(stop));
    await assertFails(user.ref('admins/rider').set(true));
  });

  it('lets a password admin create a route and its stops atomically, then deactivate the route', async () => {
    await seed({ admins: { [adminUid]: true } });
    const admin = db(adminUid);
    const secondStop = { ...stop, orden: 2 };

    await assertSucceeds(admin.ref().update({ 'rutas/r': route, 'paradas/p': stop, 'paradas/q': secondStop }));
    expect((await admin.ref('rutas/r').get()).val()).toEqual(route);
    expect((await admin.ref('paradas').get()).val()).toEqual({ p: stop, q: secondStop });

    await assertSucceeds(admin.ref('rutas/r/activa').set(false));
    expect((await admin.ref('rutas/r').get()).val()).toEqual({ ...route, activa: false });
  });

  it('denies catalog writes to an anonymous token even when its UID is an admin', async () => {
    await seed({ admins: { [adminUid]: true }, rutas: { r: route } });
    const anonymous = db(adminUid, 'anonymous');

    await assertFails(anonymous.ref('rutas/r').set(route));
    await assertFails(anonymous.ref('paradas/p').set(stop));
  });

  it('denies collection replacement and route deletion but allows stop deletion', async () => {
    await seed({ admins: { [adminUid]: true }, rutas: { r: route }, paradas: { p: stop } });
    const admin = db(adminUid);

    await assertFails(admin.ref('rutas').set({ r: route }));
    await assertFails(admin.ref('paradas').set({ p: stop }));
    await assertFails(admin.ref('rutas/r').set(null));
    expect((await admin.ref('rutas/r').get()).val()).toEqual(route);
    await assertSucceeds(admin.ref('paradas/p').set(null));
    expect((await admin.ref('paradas/p').get()).exists()).toBe(false);
  });

  it.each(['missing', '', 'a/b'])('rejects a stop referencing route %j', async (ruta_id) => {
    await seed({ admins: { [adminUid]: true }, rutas: { r: route } });
    await assertFails(db(adminUid).ref('paradas/p').set({ ...stop, ruta_id }));
  });

  it.each([
    ['extra field', { ...route, extra: true }],
    ['non-numeric coordinate', { ...route, polyline: [{ latitude: '4.6', longitude: -74.1 }] }],
    ['empty line ID', { ...route, linea_id: '' }],
    ['oversized name', { ...route, nombre: 'x'.repeat(121) }],
  ])('rejects a route with %s', async (_label, invalidRoute) => {
    await seed({ admins: { [adminUid]: true } });
    await assertFails(db(adminUid).ref('rutas/r').set(invalidRoute));
  });

  it('rejects invalid activa and oversized stop names on child updates', async () => {
    await seed({ admins: { [adminUid]: true }, rutas: { r: route }, paradas: { p: stop } });
    const admin = db(adminUid);

    await assertFails(admin.ref('rutas/r/activa').set('no'));
    await assertFails(admin.ref('paradas/p/nombre').set('x'.repeat(81)));
  });

  it('restricts admin reads to the matching UID and catalog reads to signed-in clients', async () => {
    await seed({ admins: { [adminUid]: true }, rutas: { r: route }, paradas: { p: stop } });
    const guest = env.unauthenticatedContext().database();

    expect((await assertSucceeds(db(adminUid).ref(`admins/${adminUid}`).get())).val()).toBe(true);
    for (const provider of ['anonymous', 'password'] as const) {
      const rider = db('rider', provider);
      await assertFails(rider.ref(`admins/${adminUid}`).get());
      expect((await assertSucceeds(rider.ref('rutas').get())).val()).toEqual({ r: route });
      expect((await assertSucceeds(rider.ref('paradas').get())).val()).toEqual({ p: stop });
    }
    await assertFails(guest.ref('rutas').get());
    await assertFails(guest.ref('paradas').get());
  });

  it('accepts every seeded route and stop when rewritten through admin validation', async () => {
    const catalog = JSON.parse(readFileSync(new URL('../../firebase/seed.json', import.meta.url), 'utf8'));
    await seed(catalog);
    await env.withSecurityRulesDisabled(async (context) => {
      await context.database().ref(`admins/${adminUid}`).set(true);
    });
    const admin = db(adminUid);

    for (const collection of ['rutas', 'paradas']) {
      const entries = Object.entries(catalog[collection]);
      expect(entries.length).toBeGreaterThan(0);
      for (const [id, value] of entries) {
        await assertSucceeds(admin.ref(`${collection}/${id}`).set(value));
      }
    }
  });
});

describe('vehicle, user and metric rules', () => {
  const ownerUid = 'driver';
  const profile = { consentimiento: { aceptado: true } };

  it('allows only a consenting owner to publish an active vehicle', async () => {
    await seed({
      usuarios: { [ownerUid]: profile, 'no-consent': { consentimiento: { aceptado: false } }, other: profile },
    });
    const vehicle = {
      lat: 4.6,
      lng: -74.1,
      timestamp_ultima_actualizacion: 1,
      ruta_activa: 'r',
      velocidad_actual: 0,
      en_servicio: true,
    };
    const ownedPath = `vehiculos_activos/${ownerUid}`;

    await assertFails(db('no-consent').ref('vehiculos_activos/no-consent').set(vehicle));
    await assertFails(db('other').ref(ownedPath).set(vehicle));
    await assertSucceeds(db(ownerUid).ref(ownedPath).set(vehicle));
    expect((await db(ownerUid).ref(ownedPath).get()).val()).toEqual(vehicle);
  });

  it('allows only the owner to read or write their user record', async () => {
    const path = `usuarios/${ownerUid}`;
    const owner = db(ownerUid);
    const other = db('other');

    await assertSucceeds(owner.ref(path).set(profile));
    expect((await assertSucceeds(owner.ref(path).get())).val()).toEqual(profile);
    await assertFails(other.ref(path).get());
    await assertFails(other.ref(path).set(profile));
  });

  it('allows authenticated metric creation but denies overwrites and deletion', async () => {
    const path = 'metricas/first';
    const metric = db(ownerUid).ref(path);

    await assertFails(env.unauthenticatedContext().database().ref(path).set({ value: 1 }));
    await assertSucceeds(metric.set({ value: 1 }));
    await assertFails(metric.set({ value: 2 }));
    await assertFails(metric.set(null));
    await env.withSecurityRulesDisabled(async (context) => {
      expect((await context.database().ref(path).get()).val()).toEqual({ value: 1 });
    });
  });
});
