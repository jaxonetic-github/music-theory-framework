# Music Theory Framework

An immutable, plugin-scoped music theory framework with generation, notation, rendering, export, deterministic playback planning, a headless application workflow, and an accessible React web adapter.

## Architecture

- v6 Foundation, registries, Kernel, Theory, Notation, and Rendering
- v7.0 immutable MusicXML Export Core
- v7.1 headless Application Workflow Core
- v7.2 React Web Application Adapter
- v7.3 Playback Planning Core for exact, audio-free ScoreGraph scheduling

Playback Planning produces immutable tick plans only. Web Audio, Web MIDI, transport controls, and React playback UI remain outside the current architecture.

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

The current repository suite contains **155 passing tests**.
