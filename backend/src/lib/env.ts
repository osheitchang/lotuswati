function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  JWT_SECRET: getRequiredEnv('JWT_SECRET'),
  WA_VERIFY_TOKEN: getRequiredEnv('WA_VERIFY_TOKEN'),
};
