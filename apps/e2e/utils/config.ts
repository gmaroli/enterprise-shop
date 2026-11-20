function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing env variable ${name}. Copy apps/e2e/.env.example to apps/e2e/.env and fill it in.`,
    );
  }
  return value;
}

export const admin = {
  email: requireEnv('E2E_ADMIN_EMAIL'),
  password: requireEnv('E2E_ADMIN_PASSWORD'),
};

export const customer = {
  email: requireEnv('E2E_CUSTOMER_EMAIL'),
  password: requireEnv('E2E_CUSTOMER_PASSWORD'),
};
