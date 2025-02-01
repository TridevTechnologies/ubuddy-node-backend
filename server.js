const app = require('./app');
const pool = require('./config/db');

const PORT = process.env.PORT || 3002;

pool.connect()
    .then(() => {
        console.log('Connected to PostgreSQL');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => console.error('Database connection error:', err));
