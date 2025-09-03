import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

import { UserService } from '@/user/user.service';

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(private readonly userService: UserService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    if (typeof request.session.userId === 'undefined') {
      throw new UnauthorizedException(
        'The user is not authorized. Please log in to gain access.'
      );
    }

    const user = await this.userService.findById(request.session.userId);

    request.user = user;

    return true;
  }
}
