/**
 * Browser compatibility wrapper for Chrome Extension APIs
 * Provides a simplified interface that works across Chrome, Brave, Edge, Opera, etc.
 *
 * Usage: Import `browser` instead of using `chrome` directly
 * Example: browser.sidePanel.setOptions(...) instead of chrome.sidePanel.setOptions(...)
 */

/**
 * Cross-browser compatible sidePanel/sidebar API
 */
const sidePanel = {
	/**
	 * Check if any sidebar API is available
	 */
	isAvailable(): boolean {
		if (typeof chrome === "undefined") return false;
		return !!(chrome.sidePanel || (chrome as any).sidebarAction);
	},

	/**
	 * Set sidebar panel options (enable/disable, set path)
	 */
	async setOptions(options: {
		enabled?: boolean;
		path?: string;
	}): Promise<void> {
		// Try modern API first (Chrome 114+, modern Brave/Edge)
		if (chrome.sidePanel) {
			await chrome.sidePanel.setOptions(options);
		}
		// Try legacy API
		else if ((chrome as any).sidebarAction) {
			if (options.path) {
				await (chrome as any).sidebarAction.setPanel({
					panel: options.path,
				});
			}
		}
		// Fallback: log warning
		else {
			console.warn(
				"[Browser] sidePanel API not available in this browser"
			);
		}
	},

	/**
	 * Open the sidebar programmatically
	 */
	async open(options?: { windowId?: number }): Promise<void> {
		console.log("[Browser] sidePanel.open() called with options:", options);

		if (typeof chrome === "undefined") {
			console.error("[Browser] chrome is undefined");
			return;
		}

		if (chrome.sidePanel?.open) {
			console.log("[Browser] Using chrome.sidePanel.open()");
			try {
				// Try with windowId if provided, otherwise without options
				if (options?.windowId) {
					console.log(
						"[Browser] Opening sidebar for window:",
						options.windowId
					);
					await chrome.sidePanel.open({ windowId: options.windowId });
				} else {
					console.log(
						"[Browser] Opening sidebar without window specification"
					);
					// Some browsers require empty object, some work better without params
					await chrome.sidePanel.open({} as any);
				}
				console.log("[Browser] chrome.sidePanel.open() succeeded");
			} catch (error) {
				console.error(
					"[Browser] chrome.sidePanel.open() failed:",
					error
				);
				// Log more details about the error
				if (error instanceof Error) {
					console.error("[Browser] Error message:", error.message);
					console.error("[Browser] Error stack:", error.stack);
				}
				throw error;
			}
		} else if ((chrome as any).sidebarAction?.open) {
			console.log("[Browser] Using chrome.sidebarAction.open()");
			await (chrome as any).sidebarAction.open();
		} else {
			console.warn("[Browser] Cannot open sidebar - API not available");
		}
	},

	/**
	 * Get sidebar options
	 */
	async getOptions(options?: { tabId?: number }): Promise<any> {
		if (chrome.sidePanel?.getOptions) {
			return await chrome.sidePanel.getOptions(options || {});
		}
		return null;
	},
};

/**
 * Cross-browser compatible notifications API
 * Handles differences in notification support and permissions across browsers
 */
const notifications = {
	/**
	 * Check if notifications API is available
	 */
	isAvailable(): boolean {
		return !!(
			(typeof chrome !== "undefined" && chrome.notifications) ||
			(globalThis.window !== undefined &&
				(globalThis as any).Notification) ||
			(typeof navigator !== "undefined" &&
				(navigator as any).notification)
		);
	},

	/**
	 * Check notification permission status
	 */
	async checkPermission(): Promise<string> {
		// Chrome extension notifications don't require permission check
		// They're granted through manifest.json permissions
		if (typeof chrome !== "undefined" && chrome.notifications) {
			return "granted";
		}

		// Web Notifications API
		if (globalThis.window !== undefined && "Notification" in globalThis) {
			return (globalThis as any).Notification.permission;
		}

		return "denied";
	},

	/**
	 * Request notification permissions (for web notifications fallback)
	 */
	async requestPermission(): Promise<NotificationPermission> {
		if (globalThis.window !== undefined && "Notification" in globalThis) {
			return await (globalThis as any).Notification.requestPermission();
		}
		return "denied";
	},

	/**
	 * Create a notification with browser-specific handling
	 */
	async create(
		notificationId: string | chrome.notifications.NotificationOptions,
		options?: chrome.notifications.NotificationOptions
	): Promise<string> {
		// Handle overloaded signature: create(options) or create(id, options)
		let id: string;
		let opts: chrome.notifications.NotificationOptions;

		if (typeof notificationId === "string") {
			id = notificationId;
			opts = options!;
		} else {
			id = `notif-${Date.now()}`;
			opts = notificationId;
		}

		// Try Chrome extension notifications API first
		if (typeof chrome !== "undefined" && chrome.notifications?.create) {
			try {
				return await new Promise((resolve, reject) => {
					chrome.notifications.create(id, opts as any, (notifId) => {
						if (chrome.runtime.lastError) {
							reject(
								new Error(
									chrome.runtime.lastError.message ||
										"Unknown error"
								)
							);
						} else {
							resolve(notifId);
						}
					});
				});
			} catch (error) {
				console.warn(
					"[Browser] Chrome notifications failed, trying fallback:",
					error
				);
			}
		}

		// Fallback to Web Notifications API
		if (globalThis.window !== undefined && "Notification" in globalThis) {
			const permission = await this.checkPermission();

			if (permission === "granted") {
				const notification = new (globalThis as any).Notification(
					opts.title || "Notification",
					{
						body: opts.message,
						icon: opts.iconUrl,
						badge: opts.iconUrl,
						tag: id,
						requireInteraction: opts.requireInteraction,
					}
				);

				// Store reference for later clearing
				(this as any)._webNotifications =
					(this as any)._webNotifications || {};
				(this as any)._webNotifications[id] = notification;

				return id;
			} else if (permission === "default") {
				console.warn(
					"[Browser] Notification permission not granted. Requesting..."
				);
				const newPermission = await this.requestPermission();
				if (newPermission === "granted") {
					return this.create(id, opts);
				}
			}
		}

		console.warn(
			"[Browser] Notifications not available in this environment"
		);
		return id;
	},

	/**
	 * Clear/close a notification
	 */
	async clear(notificationId: string): Promise<boolean> {
		// Try Chrome extension API
		if (typeof chrome !== "undefined" && chrome.notifications?.clear) {
			try {
				return await new Promise((resolve) => {
					chrome.notifications.clear(notificationId, (wasCleared) => {
						resolve(wasCleared);
					});
				});
			} catch (error) {
				console.warn("[Browser] Failed to clear notification:", error);
			}
		}

		// Try Web Notifications API
		if ((this as any)._webNotifications?.[notificationId]) {
			(this as any)._webNotifications[notificationId].close();
			delete (this as any)._webNotifications[notificationId];
			return true;
		}

		return false;
	},

	/**
	 * Get all notification IDs
	 */
	async getAll(): Promise<string[]> {
		if (typeof chrome !== "undefined" && chrome.notifications?.getAll) {
			return await new Promise((resolve) => {
				chrome.notifications.getAll((notifications) => {
					resolve(Object.keys(notifications));
				});
			});
		}

		// Web notifications don't have a getAll method
		return Object.keys((this as any)._webNotifications || {});
	},

	/**
	 * Update a notification
	 */
	async update(
		notificationId: string,
		options: chrome.notifications.NotificationOptions
	): Promise<boolean> {
		if (typeof chrome !== "undefined" && chrome.notifications?.update) {
			try {
				return await new Promise((resolve) => {
					chrome.notifications.update(
						notificationId,
						options,
						(wasUpdated) => {
							resolve(wasUpdated);
						}
					);
				});
			} catch (error) {
				console.warn("[Browser] Failed to update notification:", error);
			}
		}

		// Web Notifications API doesn't support updating
		// Clear and recreate instead
		await this.clear(notificationId);
		await this.create(notificationId, options);
		return true;
	},

	/**
	 * Add click event listener
	 */
	onClicked: (typeof chrome !== "undefined" &&
		chrome.notifications?.onClicked) || {
		addListener: () => {
			console.warn(
				"[Browser] Notification click listeners not available"
			);
		},
	},

	/**
	 * Add close event listener
	 */
	onClosed: (typeof chrome !== "undefined" &&
		chrome.notifications?.onClosed) || {
		addListener: () => {
			console.warn(
				"[Browser] Notification close listeners not available"
			);
		},
	},

	/**
	 * Add button click event listener
	 */
	onButtonClicked: (typeof chrome !== "undefined" &&
		chrome.notifications?.onButtonClicked) || {
		addListener: () => {
			console.warn(
				"[Browser] Notification button click listeners not available"
			);
		},
	},
};

/**
 * Browser-agnostic extension API wrapper
 * Use this instead of the global `chrome` object for better compatibility
 */
export const browser = {
	// Pass-through for standard APIs that work everywhere
	storage: typeof chrome === "undefined" ? undefined : chrome.storage,
	runtime: typeof chrome === "undefined" ? undefined : chrome.runtime,
	tabs: typeof chrome === "undefined" ? undefined : chrome.tabs,
	windows: typeof chrome === "undefined" ? undefined : chrome.windows,
	action: typeof chrome === "undefined" ? undefined : chrome.action,

	// Cross-browser compatible APIs
	notifications,
	sidePanel,

	/**
	 * Check if we're running in a specific browser
	 */
	is: {
		chrome(): boolean {
			return (
				/Chrome/.test(navigator.userAgent) &&
				!/Edg|OPR/.test(navigator.userAgent) &&
				!(navigator as any).brave
			);
		},
		brave(): boolean {
			return !!(navigator as any).brave;
		},
		edge(): boolean {
			return /Edg/.test(navigator.userAgent);
		},
		opera(): boolean {
			return /OPR/.test(navigator.userAgent);
		},
	},

	/**
	 * Get browser name
	 */
	getBrowserName(): string {
		if (this.is.brave()) return "Brave";
		if (this.is.edge()) return "Edge";
		if (this.is.opera()) return "Opera";
		if (this.is.chrome()) return "Chrome";
		return "Unknown";
	},
};

/**
 * Check if sidebar/sidePanel is supported
 */
export function isSidebarSupported(): boolean {
	return browser.sidePanel.isAvailable();
}

/**
 * Check if notifications are supported
 */
export function isNotificationsSupported(): boolean {
	return browser.notifications.isAvailable();
}

/**
 * Log browser information for debugging
 */
export function logBrowserInfo(): void {
	console.log("[Browser] Running in:", browser.getBrowserName());
	console.log("[Browser] Sidebar support:", isSidebarSupported());
	console.log("[Browser] Notifications support:", isNotificationsSupported());
	console.log("[Browser] User agent:", navigator.userAgent);
}

/**
 * Helper: Show a simple notification with sensible defaults
 */
export async function showNotification(
	title: string,
	message: string,
	iconUrl?: string
): Promise<string> {
	const options: chrome.notifications.NotificationOptions = {
		type: "basic",
		iconUrl: iconUrl || "icons/icon-48.svg",
		title,
		message,
	};

	return await browser.notifications.create(options);
}

/**
 * Helper: Show a notification with action buttons
 */
export async function showNotificationWithButtons(
	title: string,
	message: string,
	buttons: { title: string }[],
	iconUrl?: string
): Promise<string> {
	const options: chrome.notifications.NotificationOptions = {
		type: "basic",
		iconUrl: iconUrl || "icons/icon-48.svg",
		title,
		message,
		buttons,
		requireInteraction: true, // Keep notification visible until user interacts
	};

	return await browser.notifications.create(options);
}

// Export testable classes for use in other modules and tests
export {
	BrowserDetector,
	SidePanelManager,
	DisplayModeManager,
	ThemeManager,
} from "./browserClasses";
