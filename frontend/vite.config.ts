import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@assistant-ui/react-ui") || id.includes("@assistant-ui/react-markdown")) {
            return "assistant-ui";
          }

          if (id.includes("@assistant-ui/react") || id.includes("@assistant-ui/core") || id.includes("@assistant-ui/store")) {
            return "assistant-runtime";
          }

          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
