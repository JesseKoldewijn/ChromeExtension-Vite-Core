export class ChromeIdentityApi {
	identity = chrome.identity;
	googleAuthApiUrl = "https://accounts.google.com/o/oauth2/auth" as const;
	clientId: string;
	scopes: string[];

	constructor(clientId: string, scopes: string[]) {
		this.clientId = clientId;
		this.scopes = scopes;
	}

	tokenCookie(
		operation: "get" | "set",
		token?: string
	): Promise<string | void> {
		return new Promise((resolve, reject) => {
			const cookieName = "authToken";
			if (operation === "get") {
				chrome.cookies.get(
					{ url: globalThis.window.location.href, name: cookieName },
					(cookie) => {
						if (chrome.runtime.lastError) {
							reject(
								chrome.runtime.lastError as InstanceType<
									typeof Error
								>
							);
						} else {
							resolve(cookie?.value || "");
						}
					}
				);
			} else if (operation === "set" && token) {
				chrome.cookies.set(
					{
						url: globalThis.window.location.href,
						name: cookieName,
						value: token,
					},
					(cookie) => {
						if (chrome.runtime.lastError) {
							reject(
								chrome.runtime.lastError as InstanceType<
									typeof Error
								>
							);
						} else {
							resolve(cookie?.value || "");
						}
					}
				);
			} else {
				reject(
					new Error(
						"Invalid operation or missing token for set operation"
					)
				);
			}
		});
	}

	getProfile() {
		return new Promise<chrome.identity.ProfileUserInfo | null>(
			(resolve, reject) => {
				this.identity.getProfileUserInfo((userInfo) => {
					if (chrome.runtime.lastError) {
						reject(
							chrome.runtime.lastError as InstanceType<
								typeof Error
							>
						);
					} else {
						resolve(userInfo);
					}
				});
			}
		);
	}

	private extractToken(redirectUrl: string | null): string | null {
		if (!redirectUrl) return null;

		const url = new URL(redirectUrl);
		return url.hash
			? new URLSearchParams(url.hash.substring(1)).get("access_token")
			: null;
	}

	signIn(interactive: boolean = true) {
		return new Promise<void>((resolve, reject) => {
			this.identity.launchWebAuthFlow(
				{
					url: `${this.googleAuthApiUrl}?client_id=${
						this.clientId
					}&response_type=token&redirect_uri=${encodeURIComponent(
						chrome.identity.getRedirectURL()
					)}&scope=${encodeURIComponent(this.scopes.join(" "))}`,
					interactive: interactive,
				},
				(redirectUrl) => {
					if (chrome.runtime.lastError) {
						reject(
							chrome.runtime.lastError as InstanceType<
								typeof Error
							>
						);
					} else {
						const token = this.extractToken(redirectUrl || null);
						if (token) {
							this.identity.getAuthToken(
								{ interactive: false },
								(tokenResponse) => {
									if (chrome.runtime.lastError) {
										reject(
											chrome.runtime
												.lastError as InstanceType<
												typeof Error
											>
										);
									} else {
										localStorage.setItem(
											"authToken",
											tokenResponse.token || ""
										);
										resolve();
									}
								}
							);
						} else {
							reject(new Error("Failed to extract token"));
						}
					}
				}
			);
		});
	}

	signOut() {
		return new Promise<void>((resolve, reject) => {
			this.identity.getAuthToken({ interactive: true }, (token) => {
				if (chrome.runtime.lastError) {
					reject(
						chrome.runtime.lastError as InstanceType<typeof Error>
					);
				} else {
					resolve();
					if (token) {
						localStorage.removeItem("authToken");
					}
				}
			});
		});
	}
}
