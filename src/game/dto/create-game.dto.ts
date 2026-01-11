import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Difficulty, GameMode } from 'prisma/generated/enums';

export class RuleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  order: number;
}

export class CreateGameDto {
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  picture?: string;

  @IsNumber()
  @Min(2)
  minPlayers: number;

  @IsNumber()
  @Max(10)
  maxPlayers: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsEnum(GameMode)
  gameMode: GameMode;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsNumber()
  @IsOptional()
  @Min(10)
  estimatedTime?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleDto)
  @IsOptional()
  rules?: RuleDto[];
}
