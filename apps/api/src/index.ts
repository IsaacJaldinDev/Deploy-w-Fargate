// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: reflect-metadata MUST be the very first import in this file.
// sequelize-typescript reads TypeScript type metadata at runtime using the
// Reflect API. If any Sequelize model is imported before reflect-metadata
// is loaded, the metadata will be undefined and column types will silently
// default to STRING — a very confusing bug.
// ─────────────────────────────────────────────────────────────────────────────
import 'reflect-metadata';

// Load .env file before reading process.env in any other module
import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { sequelize } from './database';
import healthRouter from './routes/health.routes';
import notesRouter from './routes/notes.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

// Parse incoming JSON request bodies (required for POST/PUT)
app.use(express.json());

// CORS — allow requests from the Angular frontend origin
// In production, CORS_ORIGIN is set to the web ALB DNS name
// In development, it defaults to the Angular dev server at :4200
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/', healthRouter);        // GET /health, GET /version
app.use('/notes', notesRouter);    // CRUD endpoints

// ── Error handling ────────────────────────────────────────────────────────────
// Must be registered LAST — Express identifies error handlers by their 4-argument
// signature (err, req, res, next). Registering before routes would skip the routes.
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  // Verify the database connection before accepting traffic
  await sequelize.authenticate();
  console.log('Database connection established');

  // Sync models with the database schema
  // In development: { alter: true } updates existing tables to match model definitions
  //   - Useful during active development — no manual migrations needed
  //   - Can cause data loss if columns are removed — be careful
  // In production: sync() without alter — tables must already exist
  //   - Prevents accidental schema changes in production
  //   - For real production apps, use sequelize-cli migrations instead
  const syncOptions = process.env.NODE_ENV === 'development' ? { alter: true } : {};
  await sequelize.sync(syncOptions);
  console.log('Database synced');
}

const server = app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Commit: ${process.env.GIT_COMMIT_SHA || 'local-dev'}`);

  // Start DB connection after the server is listening
  // This way the process is already up when ECS health checks begin
  start().catch((err) => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// When ECS stops a task (rolling deployment, scale-in, etc.), it sends SIGTERM
// to the process. We catch it here to:
//   1. Stop accepting new connections (server.close)
//   2. Close the database connection pool cleanly
//   3. Exit with code 0 (success — ECS considers this a clean stop)
//
// ECS waits up to 30 seconds (default stop timeout) before sending SIGKILL.
// For this simple app, shutdown takes < 1 second.
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');

  server.close(async () => {
    await sequelize.close();
    console.log('Server and database connection closed');
    process.exit(0);
  });
});
