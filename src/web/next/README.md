# Embedding and Next.js App Router

`MusicTheoryApp` is the supported complete React application component. It creates and owns a Web runtime by default. Pass `runtime` to borrow a caller-owned runtime (the component never disposes it), or pass `runtimeFactory` and `runtimeOptions` to customize an owned runtime. `className` is merged after the stable `music-theory-app` scope class. Each mount uses React-generated IDs, and each default mount creates an isolated runtime. The component renders its own `main` landmark; place it outside another `main`.

`MusicTheoryPage` is a real `"use client"` App Router boundary that only composes and forwards props to `MusicTheoryApp`. Neither reusable entry imports `src/web/main.jsx`, calls `createRoot()`, queries `#root`, or performs browser work at module evaluation time. `main.jsx` remains solely the standalone Vite mount.

Install a local checkout reproducibly with `"music-theory-framework": "file:../music-theory-framework"` (or use an npm workspace dependency), then run `npm install`. Because this package deliberately distributes source JSX, add `transpilePackages: ["music-theory-framework"]` to `next.config.mjs`:

```js
const config = { transpilePackages: ["music-theory-framework"] };
export default config;
```

Next.js global CSS should be imported by the App Router root layout:

```jsx
// app/layout.jsx
import "music-theory-framework/web/styles.css";
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

```jsx
// app/music-theory/page.jsx
import MusicTheoryPage from "music-theory-framework/web/next";
export default function Page() { return <MusicTheoryPage />; }
```

Styles are scoped to `.music-theory-app`; host elements are not reset. Responsive Exercise Practice and Worksheet behavior and print-only worksheet presentation remain intact. React and ReactDOM are peer dependencies so the host supplies one React instance. Audio behavior is unchanged and lazy; this integration adds no server APIs, persistence, networking, MIDI, grading, or downloads.
