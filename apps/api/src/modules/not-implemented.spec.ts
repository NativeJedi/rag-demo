import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../test-app';

const PLANNED: [method: 'get' | 'post' | 'delete', path: string, phase: number][] = [
  ['post', '/api/conversations/conv_x/title', 2],
  ['post', '/api/attachments', 7],
  ['get', '/api/attachments/att_x', 7],
  ['get', '/api/knowledge/documents', 6],
  ['post', '/api/knowledge/documents', 6],
  ['delete', '/api/knowledge/documents/doc_x', 6],
  ['post', '/api/knowledge/search', 6],
  ['get', '/api/mcp/servers', 8],
  ['post', '/api/mcp/servers', 8],
  ['delete', '/api/mcp/servers/x', 8],
  ['get', '/api/mcp/resources', 8],
  ['get', '/api/mcp/prompts', 8],
];

describe('planned endpoints', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it.each(PLANNED)('%s %s → 501 (phase %i)', async (method, path, phase) => {
    const res = await request(app.getHttpServer())[method](path).send({}).expect(501);
    expect(res.body).toEqual({ error: { code: 'not_implemented', message: `Planned for phase ${phase}` } });
  });

  it('GET /api/tools is empty, health and capabilities work', async () => {
    const http = request(app.getHttpServer());
    expect((await http.get('/api/tools').expect(200)).body).toEqual([]);
    expect((await http.get('/api/health').expect(200)).body).toEqual({ status: 'ok' });
    const caps = (await http.get('/api/capabilities').expect(200)).body;
    expect(caps).toMatchObject({ provider: 'mock', features: { streaming: true, tools: false, attachments: false } });
    expect(caps.models.map((m: { alias: string }) => m.alias)).toEqual(['default', 'fast']);
  });
});
