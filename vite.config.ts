import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "src/chrome-extension/manifest.json", dest: "." },
        { src: "src/chrome-extension/public/logo.png", dest: "." },
        { src: "src/chrome-extension/public/16.png", dest: "./public" },
        { src: "src/chrome-extension/public/32.png", dest: "./public" },
        { src: "src/chrome-extension/public/48.png", dest: "./public" },
        { src: "src/chrome-extension/public/192.png", dest: "./public" },
        { src: "src/chrome-extension/images/*", dest: "./images" },
      ],
    }),
  ],
  server: {
    open: "/popup-local.html",
  },
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        "content-script": resolve(__dirname, "src/content/index.ts"),
        background: resolve(__dirname, "src/chrome-extension/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Content script and background worker should not have hash in filename
          if (chunkInfo.name === "content-script" || chunkInfo.name === "background") {
            return "[name].js";
          }
          return "[name].js";
        },
      },
    },
  },
});
