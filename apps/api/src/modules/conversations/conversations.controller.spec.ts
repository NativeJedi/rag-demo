import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test-app';

describe('conversations API', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('creates with a default title', async () => {
    const res = await http().post('/api/conversations').send({}).expect(201);
    expect(res.body).toMatchObject({ title: 'New chat' });
    expect(res.body.id).toMatch(/^conv_/);
  });

  it('lists newest first and gets one with messages', async () => {
    const a = (await http().post('/api/conversations').send({ title: 'A' })).body;
    await new Promise((r) => setTimeout(r, 5));
    const b = (await http().post('/api/conversations').send({ title: 'B' })).body;
    const list = (await http().get('/api/conversations').expect(200)).body as { id: string }[];
    expect(list.findIndex((c) => c.id === b.id)).toBeLessThan(list.findIndex((c) => c.id === a.id));
    expect((await http().get(`/api/conversations/${a.id}`).expect(200)).body).toMatchObject({ id: a.id, messages: [] });
  });

  it('deletes, then 404s with the error shape', async () => {
    const c = (await http().post('/api/conversations').send({})).body;
    await http().delete(`/api/conversations/${c.id}`).expect(204);
    const res = await http().get(`/api/conversations/${c.id}`).expect(404);
    expect(res.body.error.code).toBe('not_found');
    await http().delete(`/api/conversations/${c.id}`).expect(404);
  });

  it('validates input with a 400 error body', async () => {
    const res = await http().post('/api/conversations').send({ title: '' }).expect(400);
    expect(res.body.error.code).toBe('validation_error');
  });
});
