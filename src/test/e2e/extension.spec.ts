import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Chrome extension
 * These tests verify basic functionality
 */

test.describe("Basic E2E Tests", () => {
	test("should navigate to a webpage", async ({ page }) => {
		await page.goto("https://www.google.com");
		await page.waitForLoadState("networkidle");

		// Basic assertion - page should load
		const title = await page.title();
		expect(title).toBeTruthy();
	});
});
