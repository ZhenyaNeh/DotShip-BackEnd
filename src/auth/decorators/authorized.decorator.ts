import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/__generated__';
import { Request } from 'express';

export const Authorized = createParamDecorator(
  (data: keyof User, context: ExecutionContext) => {
    const request: Request = context.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  }
);
