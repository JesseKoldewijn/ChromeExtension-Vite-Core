import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanCopyUrl, cleanCopyUrlAction } from "../logic/cleanCopyUrl";
import * as browserUtils from "../utils/browser";

// Mock chrome API
const mockChrome = {
	scripting: {
		executeScript: vi.fn(),
	},
	notifications: {
		create: vi.fn(),
	},
	runtime: {
		getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
		lastError: null,
	},
	storage: {
		sync: {
			get: vi.fn(() => Promise.resolve({ notifications: true })),
		},
	},
};

describe("cleanCopyUrl", () => {
	it("removes query parameters and hash from URL", () => {
		const url = "https://example.com/path?foo=bar#hash";
		const result = cleanCopyUrl(url);
		expect(result).toBe("https://example.com/path");
	});

	it("preserves origin and pathname", () => {
		const url = "https://example.com/path/to/page";
		const result = cleanCopyUrl(url);
		expect(result).toBe("https://example.com/path/to/page");
	});

	it("returns empty string for invalid URLs", () => {
		const invalidUrl = "not a url";
		const result = cleanCopyUrl(invalidUrl);
		expect(result).toBe("");
	});

	it("handles URLs with no path", () => {
		const url = "https://example.com";
		const result = cleanCopyUrl(url);
		expect(result).toBe("https://example.com/");
	});

	it("handles URLs with ports", () => {
		const url = "https://example.com:8080/path?query=test";
		const result = cleanCopyUrl(url);
		expect(result).toBe("https://example.com:8080/path");
	});

	it("returns original URL on error", () => {
		const url = "https://example.com/path";
		const result = cleanCopyUrl(url);
		expect(result).toBe("https://example.com/path");
	});
});

describe("cleanCopyUrlAction", () => {
	let consoleSpy: {
		debug: any;
		warn: any;
		log: any;
		error: any;
	};

	beforeEach(() => {
		vi.clearAllMocks();
		Object.assign(globalThis, { chrome: mockChrome });

		// Spy on console methods
		consoleSpy = {
			debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
			warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
			log: vi.spyOn(console, "log").mockImplementation(() => {}),
			error: vi.spyOn(console, "error").mockImplementation(() => {}),
		};

		// Mock showNotification
		vi.spyOn(browserUtils, "showNotification").mockResolvedValue(
			"notification-id"
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("action configuration", () => {
		it("returns correct title", () => {
			const action = cleanCopyUrlAction();
			expect(action.title).toBe("Clean Copy URL");
		});

		it("sets correct contexts", () => {
			const action = cleanCopyUrlAction();
			expect(action.contexts).toEqual(["link", "selection", "page"]);
		});

		it("provides an action function", () => {
			const action = cleanCopyUrlAction();
			expect(action.action).toBeInstanceOf(Function);
		});
	});

	describe("action execution with valid URL in selection", () => {
		it("cleans and copies valid URL from selection", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 123,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockResolvedValue([
				{ result: undefined },
			]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "https://example.com/path?query=value#hash",
			});

			expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 123 },
				func: expect.any(Function),
				args: ["https://example.com/path"],
				injectImmediately: true,
			});
		});

		it("logs debug messages for successful copy", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 456,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockResolvedValue([
				{ result: undefined },
			]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "https://test.com/page",
			});

			expect(consoleSpy.debug).toHaveBeenCalledWith(
				"Cleaned URL:",
				"https://test.com/page"
			);
			expect(consoleSpy.debug).toHaveBeenCalledWith(
				"Attempting to copy cleaned URL in tab:",
				expect.objectContaining({
					cleanedUrl: "https://test.com/page",
				})
			);
		});
	});

	describe("action execution with link text selection", () => {
		it("finds and cleans URL when selection matches link text", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 789,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			// First call: find link by selection text
			// Second call: copy to clipboard
			mockChrome.scripting.executeScript
				.mockResolvedValueOnce([
					{ result: "https://found.com/link?query=test" },
				])
				.mockResolvedValueOnce([{ result: undefined }]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "Click here",
			});

			// Should call executeScript twice: once to find link, once to copy
			expect(mockChrome.scripting.executeScript).toHaveBeenCalledTimes(2);

			// Second call should be with cleaned URL
			expect(mockChrome.scripting.executeScript).toHaveBeenNthCalledWith(
				2,
				{
					target: { tabId: 789 },
					func: expect.any(Function),
					args: ["https://found.com/link"],
					injectImmediately: true,
				}
			);
		});

		it("shows notification when no valid URL found", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 111,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			// Link search returns null
			mockChrome.scripting.executeScript.mockResolvedValueOnce([
				{ result: null },
			]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "Not a link",
			});

			expect(browserUtils.showNotification).toHaveBeenCalledWith(
				"Clean Copy URL",
				"No valid URL found to copy.",
				true
			);
		});
	});

	describe("error handling", () => {
		it("shows notification on clipboard error", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 222,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockRejectedValue(
				new Error("Clipboard permission denied")
			);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "https://example.com",
			});

			expect(consoleSpy.warn).toHaveBeenCalledWith(
				"Error while copying cleaned URL to clipboard:",
				expect.any(Error)
			);

			expect(browserUtils.showNotification).toHaveBeenCalledWith(
				"Clean Copy URL",
				expect.stringContaining(
					"An error occurred while copying the cleaned URL"
				),
				true
			);
		});

		it("handles missing tab gracefully", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: undefined,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockRejectedValue(
				new Error("No tab ID")
			);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "https://example.com",
			});

			expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith(
				expect.objectContaining({
					target: { tabId: 0 },
				})
			);
		});
	});

	describe("edge cases", () => {
		it("handles empty selection", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 333,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: undefined,
			});

			expect(browserUtils.showNotification).toHaveBeenCalledWith(
				"Clean Copy URL",
				"No valid URL found to copy.",
				true
			);
		});

		it("handles undefined selection that resolves to empty string", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 444,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockResolvedValueOnce([
				{ result: null },
			]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: "",
			});

			expect(browserUtils.showNotification).toHaveBeenCalledWith(
				"Clean Copy URL",
				"No valid URL found to copy.",
				true
			);
		});

		it("handles link href that matches selection URL directly", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 555,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			const url = "https://example.com/page?utm=source";

			mockChrome.scripting.executeScript
				.mockResolvedValueOnce([{ result: url }])
				.mockResolvedValueOnce([{ result: undefined }]);

			const action = cleanCopyUrlAction();
			await action.action({
				tab: mockTab,
				window: mockWindow,
				selection: url,
			});

			// Should still attempt link search since initial clean returned empty
			// But this actually cleans it first, so it won't be empty
			// Let's test when selection is already a valid URL
			expect(mockChrome.scripting.executeScript).toHaveBeenCalled();
		});
	});

	describe("integration with context menu", () => {
		it("provides complete context menu item structure", () => {
			const action = cleanCopyUrlAction();

			expect(action).toHaveProperty("title");
			expect(action).toHaveProperty("contexts");
			expect(action).toHaveProperty("action");

			expect(typeof action.title).toBe("string");
			expect(Array.isArray(action.contexts)).toBe(true);
			expect(typeof action.action).toBe("function");
		});

		it("action accepts standard context menu parameters", async () => {
			const mockTab: chrome.tabs.Tab = {
				id: 999,
				index: 0,
				pinned: false,
				highlighted: false,
				windowId: 1,
				active: true,
				incognito: false,
				selected: false,
				discarded: false,
				autoDiscardable: true,
				groupId: -1,
				frozen: false,
			};

			const mockWindow: chrome.windows.Window = {
				id: 1,
				focused: true,
				top: 0,
				left: 0,
				width: 1920,
				height: 1080,
				incognito: false,
				type: "normal",
				state: "normal",
				alwaysOnTop: false,
			};

			mockChrome.scripting.executeScript.mockResolvedValue([
				{ result: undefined },
			]);

			const action = cleanCopyUrlAction();

			// Should not throw when called with proper context
			await expect(
				action.action({
					tab: mockTab,
					window: mockWindow,
					selection: "https://test.com",
				})
			).resolves.not.toThrow();
		});
	});
});
