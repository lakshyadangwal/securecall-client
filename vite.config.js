import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": "http://localhost:5000",
      "/friends": "http://localhost:5000",
      "/ice-config": "http://localhost:5000",
    },
  },
});