import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Validate,
} from 'class-validator';

import { IsPasswordsMatchingConstraint } from '@/libs/common/decorators/is-passwords-matching-constraint.decorator';

export class RegisterDto {
  @IsString({ message: 'The name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsString({ message: 'Email must be a string.' })
  @IsEmail({}, { message: 'Incorrect email format.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @IsString({ message: 'The password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, {
    message: 'Password must be at least 6 characters long.',
  })
  password: string;

  @IsString({ message: 'Confirmation password must be a string.' })
  @IsNotEmpty({ message: 'The password confirmation field cannot be empty.' })
  @MinLength(6, {
    message: 'The confirmation password must be at least 6 characters long.',
  })
  @Validate(IsPasswordsMatchingConstraint, {
    message: 'The passwords do not match.',
  })
  passwordRepeat: string;
}
