# Music Theory Framework

An immutable, plugin-scoped music theory framework with a headless application workflow and an accessible React web adapter.

## Development

```sh
npm install
npm run dev
```

Vite serves the React adapter, which bootstraps the existing Theory, Notation, Rendering, Export, and Application Core modules.

## Validation

```sh
npm test
npm run build
git diff --check
```

The production build is emitted to `dist/`. See [`src/web/README.md`](src/web/README.md) for the adapter architecture, trusted SVG boundary, and MusicXML download behavior.

The current repository suite contains **133 passing tests**.
