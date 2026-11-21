import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  const allowedOrigins = new Set(
    (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        try {
          return new URL(value).origin;
        } catch {
          return value.replace(/\/$/, '');
        }
      })
  );
  app.use(cors({
    origin(origin, callback) {
      // Non-browser clients do not send Origin and are not subject to CORS.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.use('/api/v1', routes);

  app.use(errorHandler);

  return app;
}
