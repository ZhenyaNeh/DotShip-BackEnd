import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class NewPasswordDto {
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'The password must be at least 6 characters long.' })
  @IsNotEmpty({ message: 'The new password field cannot be empty.' })
  password: string;
}
