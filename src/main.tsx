import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./chrome-extension/popup/index";
import "./chrome-extension/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Vi fjerner div-en som hadde w-[600px] og h-[500px] */}
    <Popup />
  </StrictMode>
);