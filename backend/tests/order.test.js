// Test cho API orders
const request = require('supertest');
const app = require('../src/app');

describe('Order API', () => {
  test('POST /api/orders/checkout - không có token', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({ cartItems: [] });

    expect(res.statusCode).toBe(401);
  });

  test('GET /api/orders/my-orders - không có token', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/health - server sống', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});