const hot = import.meta.hot || import.meta.webpackHot || (typeof module !== "undefined" ? module.hot : undefined);

if (hot) {
  hot.accept();
}

import("./index.js")
  .catch((error) => {
    console.warn("[bench] ignored all-case runtime error", error?.message || error);
  })
  .finally(() => {
    if (document.querySelector("#root > *, #react-root > *")) {
      return;
    }

    const root = document.getElementById("root") || document.body;
    const ready = document.createElement("div");
    ready.setAttribute("data-bench-ready", "true");
    root.appendChild(ready);
  });
