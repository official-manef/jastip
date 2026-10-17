import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import schema from '../../src/convex/schema';
import { api } from '../../src/convex/_generated/api';
import type { QueryCtx } from '../../src/convex/_generated/server';

// Exercise real functions, database indexes and validators. Only the auth-provider
// boundary is replaced, so these tests never create accounts in production.
vi.mock('../../src/convex/auth', () => ({ authComponent: {
  safeGetAuthUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? { _id: identity.subject, name: identity.subject, email: 'qa@example.com' } : null;
  },
} }));
const modules = import.meta.glob('../../src/convex/**/*.*s');

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const [userId, role] of [
      ['alice', 'klien'], ['bob', 'klien'], ['carrier', 'jastiper'],
      ['outsider', 'jastiper'], ['operator', 'admin'],
    ] as const) await ctx.db.insert('profiles', { userId, role });
  });
  const as = (subject: string) => t.withIdentity({ subject });
  const result = await as('alice').mutation(api.titipan.create, {
    arah: 'cgk-ist', nama: 'Private item', kg: 1, catatan: 'Private note',
  });
  if (!result.id) throw new Error('fixture create failed');
  return { t, as, id: result.id };
}

test('unassigned and legacy titipan stay private from self-selected jastipers', async () => {
  const { t, as, id } = await fixture();
  expect(await t.query(api.titipan.list, {})).toEqual({ error: 'masuk' });
  expect(await as('bob').query(api.titipan.list, {})).toEqual({ rows: [] });
  expect(await as('carrier').query(api.titipan.list, {})).toEqual({ rows: [] });
  expect(await as('carrier').mutation(api.titipan.setStatus, { id, status: 'selesai' })).toEqual({ error: 'tidak-ada' });
  expect(await as('carrier').mutation(api.titipan.assign, { id, jastiperId: 'carrier' })).toEqual({ error: 'bukan-admin' });
  const own = await as('alice').query(api.titipan.list, {});
  expect(own).toMatchObject({ rows: [{ id, status: 'baru', jastiperId: null }] });
});

test('operator assignment grants access to exactly one carrier; revocation removes it', async () => {
  const { as, id } = await fixture();
  expect(await as('operator').mutation(api.titipan.assign, { id, jastiperId: 'bob' })).toEqual({ error: 'bukan-jastiper' });
  expect(await as('operator').mutation(api.titipan.assign, { id, jastiperId: 'carrier' })).toEqual({ ok: true });
  expect(await as('carrier').query(api.titipan.list, {})).toMatchObject({ rows: [{ id }] });
  expect(await as('outsider').query(api.titipan.list, {})).toEqual({ rows: [] });
  expect(await as('outsider').mutation(api.titipan.setStatus, { id, status: 'selesai' })).toEqual({ error: 'tidak-ada' });
  expect(await as('carrier').mutation(api.titipan.setStatus, { id, status: 'dibawa' })).toMatchObject({ ok: true });
  expect(await as('alice').mutation(api.titipan.setStatus, { id, status: 'selesai' })).toEqual({ error: 'bukan-jastiper' });
  await as('operator').mutation(api.titipan.assign, { id, jastiperId: 'outsider' });
  expect(await as('carrier').query(api.titipan.list, {})).toEqual({ rows: [] });
  expect(await as('carrier').mutation(api.titipan.setStatus, { id, status: 'selesai' })).toEqual({ error: 'tidak-ada' });
  await as('operator').mutation(api.titipan.assign, { id, jastiperId: null });
  expect(await as('outsider').query(api.titipan.list, {})).toEqual({ rows: [] });
});

test('validators reject another table ID and listing is bounded to latest 100 assigned rows', async () => {
  const { t, as } = await fixture();
  const profileId = await t.run(async (ctx) => {
    for (let i = 0; i < 105; i++) await ctx.db.insert('titipan', {
      userId: 'alice', pemilik: 'Alice', jastiperId: 'carrier', arah: 'cgk-ist',
      nama: `Item ${i}`, kg: 1, catatan: '', status: 'baru',
    });
    return (await ctx.db.query('profiles').first())!._id;
  });
  expect(await as('carrier').query(api.titipan.list, {})).toMatchObject({ rows: expect.any(Array) });
  const rows = await as('carrier').query(api.titipan.list, {});
  expect(rows.rows?.length).toBe(100);
  await expect(as('operator').mutation(api.titipan.setStatus, {
    id: profileId as never, status: 'selesai',
  })).rejects.toThrow();
});


test('self-claimed jastiper has no access and admin role stays operator-owned', async () => {
  const { as } = await fixture();
  expect(await as('newcarrier').mutation(api.accounts.claimRole, { role: 'jastiper' })).toEqual({ role: 'jastiper', locked: false });
  expect(await as('newcarrier').query(api.titipan.list, {})).toEqual({ rows: [] });
  expect(await as('intruder').mutation(api.accounts.claimRole, { role: 'admin' })).toEqual({ error: 'admin-forbidden' });
  expect(await as('alice').query(api.accounts.listPeople, {})).toEqual({ error: 'bukan-admin' });
});
