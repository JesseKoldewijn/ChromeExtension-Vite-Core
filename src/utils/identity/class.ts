import { browser } from "../browser";

// Compatibility layer for the chrome identity API
export class Identity {
	isSubVendor: boolean = false;

	constructor() {
		// Initialize the identity API
		const browserVendor = browser.getBrowserName();
		this.isSubVendor = browserVendor !== "Chrome";
	}

	getProfile() {
		// Get the user's profile information
	}

	signIn() {
		// Sign in the user
	}

	signOut() {
		// Sign out the user
	}
}
