// Content script that runs on web pages

const main = async () => {
	try {
		const browser = await import("../utils/browser").then(
			(mod) => mod.browser
		);

		// Example: Send a message to the background script
		browser.runtime?.sendMessage({ type: "CONTENT_LOADED" }, (response) => {
			console.debug("Response from background:", response);
		});

		// Example: Listen for messages from the popup or background
		browser.runtime?.onMessage.addListener(
			(message, _sender, sendResponse) => {
				console.debug("Content script received message:", message);
				sendResponse({ received: true });
				return true;
			}
		);
	} catch (error) {
		console.error("Error in content script:", error);
	}
};

main();
