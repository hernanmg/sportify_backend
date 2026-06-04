const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('Demo2026!', 10);
console.log(hash);
console.log('valid', bcrypt.compareSync('Demo2026!', hash));
