import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UserRole } from 'prisma/generated/enums';

import { Authorization } from '@/auth/decorators/auth.decorator';
import { Authorized } from '@/auth/decorators/authorized.decorator';
import { MulterFile } from '@/libs/common/yandex-storage/interfaces/multer-file.interface';

import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Authorization()
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  public async findProfile(@Authorized('id') userId: string) {
    return this.userService.findById(userId);
  }

  @Authorization()
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  public async updateProfile(
    @Authorized('id') userId: string,
    @Body() dto: UpdateUserDto
  ) {
    return this.userService.update(userId, dto);
  }

  @Authorization(UserRole.ADMIN)
  @Get('by-id/:id')
  @HttpCode(HttpStatus.OK)
  public async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Authorization()
  @HttpCode(HttpStatus.OK)
  @Patch('avatar/upload')
  @UseInterceptors(FileInterceptor('avatar'))
  public async uploadUserAvatar(
    @Authorized('id') userId: string,
    @UploadedFile() file: MulterFile
  ) {
    return this.userService.uploadUserAvatar(userId, file);
  }

  @Authorization()
  @Get('avatar/:filename')
  @HttpCode(HttpStatus.OK)
  public async getUserAvatar(
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    return this.userService.getUserAvatar(filename, res);
  }
}
