import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { TypeBaseProviderOptions } from './types/base-provider.options.types';
import type { TokenResponse } from './types/token-response.types';
import type { TypeUserInfo } from './types/user-info.types';

@Injectable()
export class BaseOAuthService<T = any> {
  private BASE_URL: string;

  public constructor(private readonly options: TypeBaseProviderOptions) {}

  protected extractUserInfo(data: T): Promise<TypeUserInfo> {
    throw new Error(`Method not implemented for data: ${JSON.stringify(data)}`);
  }

  public getAuthUrl() {
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: this.options.client_id,
      redirect_uri: this.getRedirectUrl(),
      scope: (this.options.scopes ?? []).join(' '),
      access_type: 'offline',
      prompt: 'select_account',
      // prompt: 'select_account', //'consent', //'login',
    });

    return `${this.options.authorize_url}?${query}`;
  }

  public async findUserByCode(code: string): Promise<TypeUserInfo> {
    const client_id = this.options.client_id;
    const client_secret = this.options.client_secret;

    const tokenQuery = new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri: this.getRedirectUrl(),
      grant_type: 'authorization_code',
    });

    const tokensRequest = await fetch(this.options.access_url, {
      method: 'POST',
      body: tokenQuery,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });

    if (!tokensRequest.ok) {
      throw new BadRequestException(
        `Failed to get user from ${this.options.profile_url}. Please check that the access token is correct.`
      );
    }

    const tokensResponse = (await tokensRequest.json()) as TokenResponse;

    if (!tokensResponse.access_token) {
      throw new BadRequestException(
        `No tokens with ${this.options.access_url}. Please make sure the authorization code is valid.`
      );
    }

    const userResponse = await fetch(this.options.profile_url, {
      headers: {
        Authorization: `Bearer ${tokensResponse.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new UnauthorizedException(
        `Failed to get user from ${this.options.profile_url}. Please check that the access token is correct.`
      );
    }

    const user = (await userResponse.json()) as T;
    const userData = await this.extractUserInfo(user);

    return {
      ...userData,
      access_token: tokensResponse.access_token,
      refresh_token: tokensResponse.refresh_token,
      expires_at:
        tokensResponse.expires_at || Number(tokensResponse.expires_in),
      provider: this.options.name,
    };
  }

  public getRedirectUrl() {
    return `${this.BASE_URL}/auth/oauth/callback/${this.options.name}`;
  }

  set baseUrl(value: string) {
    this.BASE_URL = value;
  }

  get name() {
    return this.options.name;
  }

  get access_url() {
    return this.options.access_url;
  }

  get profile_url() {
    return this.options.profile_url;
  }

  get scopes() {
    return this.options.scopes;
  }
}
