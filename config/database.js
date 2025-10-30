import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize;

const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL && DATABASE_URL.trim() !== '') {
  sequelize = new Sequelize(DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  const PGHOST = process.env.PGHOST;
  const PGPORT = process.env.PGPORT || 5432;
  const PGUSER = process.env.PGUSER || 'postgres';
  const PGDATABASE = process.env.PGDATABASE;
  const PGPASSWORD = process.env.PGPASSWORD || '';

  if (!PGHOST || !PGDATABASE) {
    throw new Error('Database configuration missing. Please set DATABASE_URL or PG* environment variables.');
  }

  sequelize = new Sequelize(PGDATABASE, PGUSER, PGPASSWORD, {
    host: PGHOST,
    port: PGPORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });

  console.log(`📊 Database connected via individual env vars: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}`);
}

export default sequelize;
