import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from 'prisma/generated/client';

export const Authorized = createParamDecorator(
  (data: keyof User, context: ExecutionContext) => {
    const request: Request = context.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  }
);
