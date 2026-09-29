// Test cho API auth (register, login, me)
const request = require('supertest');
const app = require('../src/app');

describe('Auth API', () => {
  const testUser = {
    username: 'testuser_' + Date.now(),
    email: `test_${Date.now()}@example.com`,
    password: 'test123456'
  };

  let token = null;

  // Test đăng ký
  test('POST /api/auth/register - đăng ký thành công', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(testUser.username);
  });

  // Test đăng ký trùng username
  test('POST /api/auth/register - username đã tồn tại', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  // Test đăng ký password ngắn
  test('POST /api/auth/register - password ngắn', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'short_' + Date.now(),
        email: `short_${Date.now()}@example.com`,
        password: '123'
      });

    expect(res.statusCode).toBe(400);
  });

  // Test đăng nhập thành công
  test('POST /api/auth/login - đăng nhập thành công', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    token = res.body.data.token;
  });

  // Test đăng nhập sai password
  test('POST /api/auth/login - sai mật khẩu', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: 'wrong_password'
      });

    expect(res.statusCode).toBe(401);
  });

  // Test lấy profile
  test('GET /api/auth/me - lấy profile với token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.username).toBe(testUser.username);
  });

  // Test không có token
  test('GET /api/auth/me - không có token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });
});