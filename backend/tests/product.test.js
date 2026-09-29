// Test cho API products
const request = require('supertest');
const app = require('../src/app');

describe('Product API', () => {
  test('GET /api/products - lấy danh sách', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/products/:id/detail - lấy chi tiết', async () => {
    const res = await request(app).get('/api/products/1/detail');
    expect([200, 404]).toContain(res.statusCode);
  });

  test('GET /api/products/:id/detail - sản phẩm không tồn tại', async () => {
    const res = await request(app).get('/api/products/999999/detail');
    expect(res.statusCode).toBe(404);
  });

  test('GET /api/categories - lấy danh mục', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});