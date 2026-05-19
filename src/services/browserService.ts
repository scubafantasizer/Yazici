import { chromium, Browser, Page } from 'playwright';

export class BrowserService {
  private browser: Browser | null = null;

  async getPage(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    const context = await this.browser.newContext();
    return await context.newPage();
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async navigateAndExtract(url: string): Promise<string> {
    const page = await this.getPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      const content = await page.textContent('body');
      return content || "No content found.";
    } finally {
      await page.close();
    }
  }
}

export const browserService = new BrowserService();
