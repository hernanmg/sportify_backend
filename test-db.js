const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5445,
  user: 'sportify_user',
  password: 'sportify_password',
  database: 'sportify_amateur',
});

client.connect()
  .then(() => {
    console.log('✅ Conexión exitosa con pg cliente directo');
    return client.query('SELECT version()');
  })
  .then(res => {
    console.log('📊 Versión PostgreSQL:', res.rows[0].version);
    client.end();
  })
  .catch(err => {
    console.error('❌ Error de conexión:', err);
  });