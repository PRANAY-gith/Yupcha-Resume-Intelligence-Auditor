import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middlewares/error';
import { NotFoundError } from './utils/errors';

const app = express();

// 1) Global Middlewares
// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Enable CORS
app.use(cors());

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// 2) API Routes
app.use('/api/v1', routes);

// 3) Handle undefined routes (404)
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// 4) Global Error Handler Middleware
app.use(errorHandler);

export default app;
export { app };
