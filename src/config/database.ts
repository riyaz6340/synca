import knex, { Knex } from 'knex';
import pg from 'pg';

// Tell pg to return DATE columns as plain strings (YYYY-MM-DD) instead of JavaScript Date objects.
// This prevents timezone-related date shift issues (e.g., June 10 becoming June 9).
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (val: string) => val);

const environment = process.env.NODE_ENV || 'development';

const connectionConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'avento_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'avento_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    migrations: {
      directory: '../migrations',
      extension: 'ts',
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};

const db: Knex = knex(connectionConfig[environment]);

export default db;
