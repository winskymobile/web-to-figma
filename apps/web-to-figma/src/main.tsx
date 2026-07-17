import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { App } from "./app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
    <Toaster
      closeButton
      position="top-center"
      richColors
      theme="light"
      toastOptions={{
        style: {
          fontFamily:
            '"IBM Plex Sans", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
        },
      }}
    />
  </StrictMode>
);
