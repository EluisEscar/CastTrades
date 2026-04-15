import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": "http://localhost:4000",
      "/requests": "http://localhost:4000",
      "/inbox": "http://localhost:4000",
      "/parks": "http://localhost:4000",
      "/locations": "http://localhost:4000",
      "/health": "http://localhost:4000"
    },
  },
});
