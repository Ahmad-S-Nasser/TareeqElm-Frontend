import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 3001,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks so app code changes don't invalidate library caches.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return "vendor-router";
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) return "vendor-query";
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return "vendor-radix";
          if (/[\\/]node_modules[\\/](recharts|recharts-scale|victory-vendor|d3-[^\\/]+|internmap)[\\/]/.test(id)) {
            return "vendor-recharts";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      VITE_API_URL: "https://api.test/api",
    },
  },
});
