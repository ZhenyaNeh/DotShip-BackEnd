import { BaseOAuthService } from './base-oauth.service';
import { TypeProviderOptions } from './types/provider-options.types';
import { TypeUserInfo } from './types/user-info.types';

interface YandexProfile extends Record<string, any> {
  login: string;
  id: string;
  client_id: string;
  psuid: string;
  emails?: string[];
  default_email?: string;
  is_avatar_empty?: boolean;
  default_avatar_id?: string;
  birthday?: string | null;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  real_name?: string;
  sex?: 'male' | 'female' | null;
  default_phone?: { id: number; number: string };
  access_token: string;
  refresh_token?: string;
}

const PROVIDER_NAME = 'yandex';

export class YandexProvider extends BaseOAuthService<YandexProfile> {
  public constructor(options: TypeProviderOptions) {
    super({
      name: PROVIDER_NAME,
      authorize_url: 'https://oauth.yandex.ru/authorize',
      access_url: 'https://oauth.yandex.ru/token',
      profile_url: 'https://login.yandex.ru/info?format=json',
      scopes: options.scopes,
      client_id: options.client_id,
      client_secret: options.client_secret,
    });
  }

  public async extractUserInfo(data: YandexProfile): Promise<TypeUserInfo> {
    return Promise.resolve({
      id: data.id,
      email: data.default_email ? data.default_email : '',
      name: data.display_name || '',
      picture: data.default_avatar_id
        ? `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`
        : '',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: 0,
      provider: PROVIDER_NAME,
    });
  }
}
