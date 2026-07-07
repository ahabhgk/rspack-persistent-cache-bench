import "./hmr-marker.js";

if (import.meta.hot) {
  import.meta.hot.accept("./hmr-marker.js");
  import.meta.hot.accept();
}

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept("./hmr-marker.js");
  import.meta.webpackHot.accept();
}

if (typeof module !== "undefined" && module.hot) {
  module.hot.accept("./hmr-marker.js");
  module.hot.accept();
}

import("./index.js");
