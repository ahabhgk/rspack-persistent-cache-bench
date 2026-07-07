export function BenchHmrMarker() {
  return null;
}

if (import.meta.hot) {
  import.meta.hot.accept();
}

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}

if (typeof module !== "undefined" && module.hot) {
  module.hot.accept();
}
