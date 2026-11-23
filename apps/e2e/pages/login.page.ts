import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '../utils/config';

export class LoginPage {
  private readonly page: Page;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;
  private readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
    this.errorAlert = page.getByRole('alert').filter({ hasText: /\S/ });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(credentials: Credentials) {
    await this.emailInput.fill(credentials.email);
    await this.passwordInput.fill(credentials.password);
    await this.submitButton.click();
  }

  errorMessage(text: string): Locator {
    return this.errorAlert.filter({ hasText: text });
  }
}
