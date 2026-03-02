import dotenv from 'dotenv';
dotenv.config();

import { listen } from '@colyseus/tools';
import app from './app.config.js';

const port = Number(process.env.PORT || 2567);
listen(app, port);
