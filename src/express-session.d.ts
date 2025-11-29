import 'express-session';
import { User } from 'prisma/generated/client';

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
