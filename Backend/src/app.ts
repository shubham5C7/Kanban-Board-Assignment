import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(origin => origin.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.use('/api/v1', routes);

  app.use(errorHandler);

  return app;
}
