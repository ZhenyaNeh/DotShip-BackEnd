import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';

import { Authorization } from '@/auth/decorators/auth.decorator';
import { Authorized } from '@/auth/decorators/authorized.decorator';

import { FriendService } from './friend.service';

@Controller('friend')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Get('request')
  @Authorization()
  @HttpCode(HttpStatus.OK)
  public async getFriendsRequest(@Authorized('id') userId: string) {
    return await this.friendService.getFriendsRequest(userId);
  }

  @Get('send')
  @Authorization()
  @HttpCode(HttpStatus.OK)
  public async getFriendsSends(@Authorized('id') userId: string) {
    return await this.friendService.getFriendsSends(userId);
  }

  @Get('/:userId')
  @Authorization()
  @HttpCode(HttpStatus.OK)
  public async getFriends(@Param('userId') userId: string) {
    return await this.friendService.getFriends(userId);
  }

  @Get('search/:search')
  @Authorization()
  @HttpCode(HttpStatus.OK)
  public async getFriendsSearch(
    @Authorized('id') userId: string,
    @Param('search') search: string
  ) {
    return await this.friendService.getFriendsSearch(userId, search);
  }
}
