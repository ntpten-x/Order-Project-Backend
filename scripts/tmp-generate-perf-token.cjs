require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

(async () => {
  const client = new Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: (process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1')
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' }
      : undefined,
  });

  await client.connect();
  const result = await client.query(
    "SELECT u.id, u.username, r.roles_name FROM users u LEFT JOIN roles r ON r.id = u.roles_id WHERE u.username = 'e2e_pos_admin' LIMIT 1"
  );
  await client.end();

  if (!result.rows.length) {
    throw new Error('e2e_pos_admin not found');
  }

  const row = result.rows[0];
  const token = jwt.sign(
    {
      id: row.id,
      username: row.username,
      role: row.roles_name || 'Admin',
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  process.stdout.write(token);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
