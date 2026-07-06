import "./style.css";
import { generatedModuleCount } from "./.generated/index.js";

document.body.innerHTML = `<main class="p-4 text-blue-500">Tailwind HMR (${generatedModuleCount} generated modules)</main>`;

if (import.meta.hot) {
  import.meta.hot.accept();
}
