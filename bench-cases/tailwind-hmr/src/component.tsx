export function message() {
  const text = "Generated code only. This prose edit should not change Tailwind classes.";
  return `${text} text-blue-500 bg-slate-950 p-4`;
}

if (import.meta.hot) {
  import.meta.hot.accept();
}
