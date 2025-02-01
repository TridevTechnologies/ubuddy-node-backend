require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: "./db/migrations"
    },
    seeds: {
      directory: "./seeds"
    }
  },
  production: {
    client: "pg",
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    migrations: {
      directory: "./db/migrations"
    },
    seeds: {
      directory: "./seeds"
    }
  }
};
