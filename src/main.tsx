import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./i18n"; // must run before the first render: detects the language and sets <html lang dir>
import App from "./App.tsx";
import { PageLoader } from "@/components/routing/PageLoader";
import "./index.css";

// Translation namespaces load lazily; Suspense shows the loader until the active language is ready.
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<PageLoader />}>
    <App />
  </Suspense>
);
