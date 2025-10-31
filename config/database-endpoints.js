import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let endpointSequelize;

// Database URL untuk endpoint management (Database Kedua)
const ENDPOINT_DATABASE_URL = process.env.ENDPOINT_DATABASE_URL;

if (ENDPOINT_DATABASE_URL && ENDPOINT_DATABASE_URL.trim() !== '') {
  endpointSequelize = new Sequelize(ENDPOINT_DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  console.log('📊 Endpoint Database connected via ENDPOINT_DATABASE_URL');
} else {
  // Fallback to individual env vars if DATABASE_URL not provided
  const PGHOST_ENDPOINTS = process.env.PGHOST_ENDPOINTS;
  const PGPORT_ENDPOINTS = process.env.PGPORT_ENDPOINTS || 5432;
  const PGUSER_ENDPOINTS = process.env.PGUSER_ENDPOINTS || 'postgres';
  const PGDATABASE_ENDPOINTS = process.env.PGDATABASE_ENDPOINTS;
  const PGPASSWORD_ENDPOINTS = process.env.PGPASSWORD_ENDPOINTS || '';

  if (!PGHOST_ENDPOINTS || !PGDATABASE_ENDPOINTS) {
    throw new Error('Endpoint database configuration missing. Please set ENDPOINT_DATABASE_URL or PG*_ENDPOINTS environment variables.');
  }

  endpointSequelize = new Sequelize(PGDATABASE_ENDPOINTS, PGUSER_ENDPOINTS, PGPASSWORD_ENDPOINTS, {
    host: PGHOST_ENDPOINTS,
    port: PGPORT_ENDPOINTS,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  console.log(`📊 Endpoint Database connected via individual env vars: ${PGUSER_ENDPOINTS}@${PGHOST_ENDPOINTS}:${PGPORT_ENDPOINTS}/${PGDATABASE_ENDPOINTS}`);
}

export default endpointSequelize;
