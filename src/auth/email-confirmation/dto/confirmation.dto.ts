import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmationDto {
  @IsString({ message: 'The token must be a string.' })
  @IsNotEmpty({ message: 'The token field cannot be empty.' })
  token: string;
}
