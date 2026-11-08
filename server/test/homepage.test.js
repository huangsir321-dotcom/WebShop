import test from 'node:test';
import assert from 'node:assert/strict';
import { HOMEPAGE_DEFAULTS, homepageInput, readHomepage, writeHomepage, resetHomepage } from '../src/services/homepage.js';

test('homepage defaults describe the shipped home page', () => {
  assert.equal(HOMEPAGE_DEFAULTS.id, 1);
  assert.equal(HOMEPAGE_DEFAULTS.heroImageUrl, '/images/hero.jpg');
  assert.equal(HOMEPAGE_DEFAULTS.storyImageUrl, '/images/story.jpg');
  assert.equal(HOMEPAGE_DEFAULTS.heroTitle1, 'Find your');
});

test('homepage image fields accept local paths and reject unsafe values', () => {
  const base = { ...HOMEPAGE_DEFAULTS };
  const good = ['/images/hero.jpg', '/images/sub-folder/photo.webp', 'https://example.com/a.jpg', ''];
  const bad = ['javascript:alert(1)', 'not-a-path', '../../secret.txt', 'C:/Windows/win.ini'];
  for (const value of good) {
    assert.equal(homepageInput.safeParse({ ...base, heroImageUrl: value }).success, true, `should accept ${value}`);
    assert.equal(homepageInput.safeParse({ ...base, storyImageUrl: value }).success, true, `should accept ${value}`);
  }
  for (const value of bad) {
    assert.equal(homepageInput.safeParse({ ...base, heroImageUrl: value }).success, false, `should reject ${value}`);
    assert.equal(homepageInput.safeParse({ ...base, storyImageUrl: value }).success, false, `should reject ${value}`);
  }
});

test('homepage copy is length limited', () => {
  const partial = homepageInput.partial();
  assert.equal(partial.safeParse({ heroEyebrow: 'x'.repeat(120) }).success, true);
  assert.equal(partial.safeParse({ heroEyebrow: 'x'.repeat(121) }).success, false);
  assert.equal(partial.safeParse({ heroBody: 'x'.repeat(1000) }).success, true);
  assert.equal(partial.safeParse({ heroBody: 'x'.repeat(1001) }).success, false);
});

test('readHomepage falls back to the defaults when the row is missing', async () => {
  const db = { homepage: { findUnique: async () => null } };
  assert.deepEqual(await readHomepage(db), HOMEPAGE_DEFAULTS);
});

test('writeHomepage always targets the single row', async () => {
  const calls = [];
  const db = { homepage: { upsert: async args => { calls.push(args); return { id: 1, ...args.create }; } } };
  await writeHomepage(db, { heroImageUrl: '/images/new.jpg' });
  assert.equal(calls[0].where.id, 1);
  assert.equal(calls[0].create.id, 1);
  assert.equal(calls[0].create.heroImageUrl, '/images/new.jpg');
  assert.equal(calls[0].update.heroImageUrl, '/images/new.jpg');
});

test('resetHomepage restores the shipped copy and does not write the id', async () => {
  let stored = {};
  const db = { homepage: { upsert: async ({ update }) => { stored = { ...stored, ...update }; return stored; } } };
  await resetHomepage(db);
  assert.equal(stored.heroImageUrl, '/images/hero.jpg');
  assert.equal(stored.heroTitle1, 'Find your');
  assert.equal(stored.storyImageUrl, '/images/story.jpg');
  assert.equal(stored.id, undefined);
});
