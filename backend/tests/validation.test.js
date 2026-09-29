// Test validation và bảo mật
const request = require('supertest');
const app = require('../src/app');

describe('Validation & Security', () => {
  test('POST /api/auth/register - thiếu username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: '123456' });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/auth/register - email không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'invalid_email', password: '123456' });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/auth/register - password quá ngắn', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'test@test.com', password: '123' });
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/auth/me - không có token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/admin/orders - không có token', async () => {
    const res = await request(app).get('/api/admin/orders');
    expect(res.statusCode).toBe(401);
  });
});