import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import {
  createCorsOrigin,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_METHODS,
} from './services/cors';

export function createApp(): Application {
  const app = express();

  const corsOptions = {
    origin: createCorsOrigin(process.env.CLIENT_URL),
    credentials: true,
    methods: CORS_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
  };
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.use('/api/v1', routes);

  app.use(errorHandler);

  return app;
}
