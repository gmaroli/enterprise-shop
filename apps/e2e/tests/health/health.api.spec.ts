import { test, expect } from '@playwright/test';

test('health endpoint reports the API and database are up', async ({ request }) => {
  const response = await request.get('health');

  await expect(response).toBeOK();
  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.database).toBe('up');
});
