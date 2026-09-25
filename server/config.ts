import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url().default('https://uoqefhebqkvlmycbimql.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('service_role_placeholder'),
  SUPABASE_ANON_KEY: z.string().min(1).default('anon_key_placeholder'),
  STORAGE_BUCKET: z.string().default('evidence-documents'),
  SIGNED_URL_TTL_SECONDS: z.string().default('300').transform((val) => parseInt(val, 10)),
  CONFIDENTIAL_FILE_PASSWORD: z.string().default('123456'),
});

const rawSupabaseUrl = (process.env.SUPABASE_URL || 'https://uoqefhebqkvlmycbimql.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');

const rawConfig = {
  PORT: process.env.PORT || '3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: rawSupabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || undefined,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET || 'evidence-documents',
  SIGNED_URL_TTL_SECONDS: process.env.SIGNED_URL_TTL_SECONDS || '300',
  CONFIDENTIAL_FILE_PASSWORD: process.env.CONFIDENTIAL_FILE_PASSWORD || '123456',
};

export const config = envSchema.parse(rawConfig);
