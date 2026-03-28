import * as Joi from 'joi';
import { MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS } from '../cache/cache-keys';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number().default(3001),
  JWT_SECRET: Joi.string().min(16).required(),
  // Meilisearch (optional; when set, search can use Meilisearch)
  MEILISEARCH_HOST: Joi.string().uri().optional().allow(''),
  MEILISEARCH_API_KEY: Joi.string().optional().allow(''),
  // Redis (optional; for caching and optionally sessions). Use redis:// or rediss://
  REDIS_URL: Joi.string().optional().allow(''),
  REDIS_HOST: Joi.string().optional().allow(''),
  REDIS_PORT: Joi.number().port().optional().default(6379),
  /** GET /restaurants list cache TTLs (seconds); capped at list max in CacheService. */
  CACHE_TTL_RESTAURANTS_NEARBY: Joi.number()
    .integer()
    .min(1)
    .max(MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS)
    .optional(),
  CACHE_TTL_RESTAURANTS_LIST: Joi.number()
    .integer()
    .min(1)
    .max(MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS)
    .optional(),
  CACHE_TTL_RESTAURANTS_DISCOVERY: Joi.number()
    .integer()
    .min(1)
    .max(MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS)
    .optional(),
  // CORS allowed origins (optional; comma-separated). When unset, defaults to dev origins.
  CORS_ORIGINS: Joi.string().optional().allow(''),
  // Google Places API (optional; required only for restaurant import script)
  GOOGLE_PLACES_API_KEY: Joi.string().optional().allow(''),
  // Google OAuth (required for Google Sign-In). Web client ID for ID token audience verification.
  GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
  // Required for mobile: exchange authorization code for id_token. Same Web client's secret in Google Cloud Console.
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  // Object storage for image uploads (optional; when set, POST /upload/image is available)
  STORAGE_BUCKET: Joi.string().optional().allow(''),
  STORAGE_REGION: Joi.string().optional().allow(''),
  STORAGE_ENDPOINT: Joi.string().uri().optional().allow(''),
  STORAGE_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  STORAGE_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
  STORAGE_PUBLIC_BASE_URL: Joi.string().uri().optional().allow(''),
});
