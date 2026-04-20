import { Sequelize } from 'sequelize-typescript';
import { Note } from './models/note.model';

// Sequelize instance — the single connection pool shared across the entire app.
// The `models` array registers all model classes. Any model not listed here
// will not be recognized by Sequelize, even if @Table is declared on it.
export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'notes_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',

  // Register all models here — add new models to this array as the app grows
  models: [Note],

  // Log SQL queries in development (helpful for learning/debugging)
  // Disabled in production to avoid flooding CloudWatch Logs with SELECT statements
  logging: process.env.NODE_ENV === 'development' ? console.log : false,

  // Connection pool settings — sensible defaults for a small Fargate task
  pool: {
    max: 5,    // maximum number of connections in pool
    min: 0,    // minimum connections (allows idle pool to drain completely)
    acquire: 30000,  // max ms to wait for a connection before throwing an error
    idle: 10000,     // ms a connection can be idle before being released
  },
});
