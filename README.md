# BeePiMart - Hệ Thống Bán Hàng Tiện Lợi

## Giới thiệu

Hệ thống thương mại điện tử full-stack với 3 vai trò: Khách hàng, Quản trị viên, và Shipper.

## Công nghệ

- Frontend: HTML5, CSS3, JavaScript ES6+
- Backend: Node.js, Express.js
- Database: PostgreSQL 15
- Authentication: JWT
- Bảo mật: bcrypt, helmet, rate limiting
- Testing: Jest, Supertest
- DevOps: Docker, Docker Compose, Nginx
- CI/CD: GitHub Actions

## Kiến trúc

- 3 container: db, backend, frontend
- Nginx reverse proxy cho API và uploads
- PostgreSQL với transaction và trigger

## Tính năng

[Xem chi tiết]

## Cài đặt

[Xem chi tiết]

## Test

npm test

## License

MIT
