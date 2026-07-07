import "./style.css";
import { generatedModuleCount } from "./.generated/index.js";
import { message } from "./component.tsx";

document.body.innerHTML = `<main class="p-4 text-blue-500">Tailwind HMR (${generatedModuleCount} generated modules)<span hidden>${message()}</span></main>`;

if (import.meta.hot) {
  import.meta.hot.accept();
}
