/**
 * E2E tests use the same pipes and filters as production (see applyProductionConfig).
 * Tests that hit the DB run only when E2E_DATABASE_READY=1 (e.g. CI after migrations).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { applyProductionConfig } from '../src/common/bootstrap-app';

const hasDb = process.env.E2E_DATABASE_READY === '1' || process.env.E2E_DATABASE_READY === 'true';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyProductionConfig(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('GET / returns 200 and Hello World!', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /health returns 200 and { status: "ok" }', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: 'ok' });
      });
  });

  (hasDb ? it : it.skip)(
    'GET /restaurants (public) returns 200 and a list or empty list',
    () =>
      request(app.getHttpServer())
        .get('/restaurants')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        }),
  );

  (hasDb ? it : it.skip)(
    'POST /auth/login with invalid credentials returns 401',
    () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrongpassword' })
        .expect(401),
  );

  (hasDb ? it : it.skip)(
    'GET /restaurants/:id for non-existent id returns 404',
    () =>
      request(app.getHttpServer())
        .get('/restaurants/999999999')
        .expect(404)
        .expect((res) => {
          expect(res.body).toMatchObject({
            statusCode: 404,
            message: 'Restaurant not found',
          });
        }),
  );
});
