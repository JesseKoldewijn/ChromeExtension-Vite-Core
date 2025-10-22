// Background service worker for the extension
import { initDisplayMode } from "../utils/displayMode";
import { browser, logBrowserInfo } from "../utils/browser";

browser.runtime?.onInstalled.addListener(async () => {
	console.log("Extension installed");
	// Log browser info for debugging
	logBrowserInfo();
	// Initialize display mode
	await initDisplayMode();

	// Check current popup state
	const popup = await browser.action?.getPopup({});
	console.log("[Background] Current popup after init:", popup);
});

// Initialize display mode on startup
browser.runtime?.onStartup.addListener(async () => {
	logBrowserInfo();
	await initDisplayMode();
});

browser.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("Message received:", message);
	sendResponse({ success: true });
	return true;
});

// Listen for changes to display mode and re-apply
browser.storage?.onChanged.addListener((changes, areaName) => {
	console.log("[Background] Storage changed:", areaName, changes);
	if (areaName === "sync" && changes.displayMode) {
		console.log(
			"[Background] Display mode changed:",
			changes.displayMode.oldValue,
			"->",
			changes.displayMode.newValue
		);
		// Re-initialize display mode when it changes
		initDisplayMode();
	}
});

// Example: Listen for tab updates
browser.tabs?.onUpdated.addListener((_tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete" && tab.url) {
		console.log("Tab updated:", tab.url);
		// send a browser notification
		browser.notifications.create({
			type: "basic",
			iconUrl: "icon-48.png",
			title: "Tab Updated",
			message: `The tab with URL ${tab.url} has been updated.`,
		});
	}
});
