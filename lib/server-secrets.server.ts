import dbConnect from '@/lib/db';
import AppConfig from '@/lib/models/AppConfig';

const DEFAULT_INTERNAL_API_KEY = 'internal_admin_cron_key_2024';

export type ServerSecrets = {
  serverBaseUrl: string;
  internalApiKey: string;
  accessTokenSecret: string | null;
  adminJwtSecret: string | null;
};

let cache: { at: number; secrets: ServerSecrets } | null = null;
const CACHE_MS = 60_000;

const trim = (value: unknown): string =>
  value == null ? '' : String(value).trim();

export function clearServerSecretsCache(): void {
  cache = null;
}

export async function getServerSecrets(): Promise<ServerSecrets> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.secrets;
  }

  await dbConnect();
  const config = (await AppConfig.findOne().lean()) as Record<string, unknown> | null;

  const secrets: ServerSecrets = {
    serverBaseUrl:
      trim(config?.serverBaseUrl) ||
      trim(process.env.API_BASE_URL) ||
      trim(process.env.SERVER_API_URL) ||
      trim(process.env.NEXT_PUBLIC_API_URL) ||
      'http://localhost:3001',
    internalApiKey:
      trim(config?.internalApiKey) ||
      trim(process.env.INTERNAL_API_KEY) ||
      DEFAULT_INTERNAL_API_KEY,
    accessTokenSecret:
      trim(config?.accessTokenSecret) ||
      trim(process.env.ACCESS_TOKEN_SECRET) ||
      trim(process.env.JWT_SECRET) ||
      null,
    adminJwtSecret:
      trim(config?.adminJwtSecret) ||
      trim(process.env.JWT_SECRET) ||
      trim(process.env.ADMIN_JWT_SECRET) ||
      null,
  };

  cache = { at: Date.now(), secrets };
  return secrets;
}
