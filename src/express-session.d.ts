import { User } from '@prisma/__generated__';
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}
