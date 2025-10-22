import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import webExtension from "vite-plugin-web-extension";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
	plugins: [
		solidPlugin(),
		tailwindcss(),
		webExtension({
			manifest: "./src/manifest.json",
			watchFilePaths: ["src/**/*"],
		}),
	],
	resolve: {
		alias: {
			"~": resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
	publicDir: "public",
});
