import { IsBoolean, IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString({ message: 'The name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsString({ message: 'Email must be a string.' })
  @IsEmail({}, { message: 'Incorrect email format.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @IsBoolean({ message: 'isTwoFactorEnable must be a boolean value.' })
  isTwoFactorEnable: boolean;
}
