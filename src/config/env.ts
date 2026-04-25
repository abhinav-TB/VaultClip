/**
 * Centralized environment variable accessor with strict types.
 * Helps prevent undefined errors across the application.
 */

interface EnvConfig {
  MODE: 'development' | 'production' | 'test'
  VITE_API_URL: string
}

const env: EnvConfig = {
  MODE: (import.meta.env.MODE as EnvConfig['MODE']) || 'development',
  VITE_API_URL: import.meta.env.VITE_API_URL || '',
}

export default env
