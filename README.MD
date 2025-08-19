# electron-esbuild

Fast and flexible Electron build tool powered by esbuild. Features hot-reload, production builds, and easy configuration.

## Features

- ⚡ Super fast builds with esbuild
- 🔄 Hot reload in development
- 🎮 Manual restart with 'r' key
- 🔧 Flexible configuration
- 🐛 Both dev and production builds

## Quick Start

```bash
npm install electron-esbuild --save-dev
```

Add scripts to your package.json:

```json
{
  "scripts": {
    "start": "electron-esbuild dev",
    "start:debug": "electron-esbuild dev --debug",
    "build": "electron-esbuild production",
    "build:debug": "electron-esbuild production --debug"
  }
}
```

## Configuration

Create `.electron-esbuildrc.json` in your project root:

```json
{
  "mode": "dev",
  "outdir": "node_modules/.electron-esbuild",
  "outdirProduction": "dist",
  "autoRestart": true,
  "debug": false,
  "entryPoints": {
    "base": "src/electron",
    "main": "index.ts",
    "preload": "preload.ts"
  }
}
```

- `npm run build:debug` - Build for production with debugging enabled

## License

MIT
