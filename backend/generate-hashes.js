const bcrypt = require('bcryptjs');

const users = [
  { username: 'admin', password: 'admin123' },
  { username: 'customer', password: 'user123' },
  { username: 'customer2', password: 'user123' },
  { username: 'shipper1', password: 'ship123' },
  { username: 'shipper2', password: 'ship123' }
];

users.forEach(u => {
  const hash = bcrypt.hashSync(u.password, 10);
  console.log(`${u.username}|${u.password}|${hash}`);
});