import { type BuildOptions } from 'esbuild'

export type EntryPoints = {
    /** @default src/electron (relative from cwd) */
    base?: string
    /** @default index.ts */
    main?: string
    /** @default preload.ts */
    preload?: string
}

export type ElectronEsbuildConfig = {
    /** `development` will start watching */
    mode: 'dev' | 'production'
    /** @default true disable for debugging prod build */
    prodMinification?: boolean
    /** @default true - when false, disables auto-restart on file changes. Manual restart with 'r' key is always enabled in dev mode */
    autoRestart?: boolean
    /** Path to executable @default electron (global or local electron) */
    electronArgs?: string[]
    /** @default node_modules/.electron-esbuild */
    outdir?: string
    /** @default dist - output directory for production builds */
    outdirProduction?: string
    entryPoints?: EntryPoints
    esbuildOptions?: Partial<BuildOptions>
    esbuildOptionsProduction?: Partial<BuildOptions>
    vitePublicDir?: string
    debug?: boolean
}

export const defaultConfig: Required<ElectronEsbuildConfig> = {
    mode: 'dev',
    prodMinification: true,
    autoRestart: true,
    outdir: 'node_modules/.electron-esbuild',
    outdirProduction: 'dist/main',
    esbuildOptions: {},
    esbuildOptionsProduction: {
        sourcemap: true,
    },
    entryPoints: {
        base: 'src/electron',
        main: 'index.ts',
        preload: 'preload.ts',
    },
    vitePublicDir: './src/react/public',
    debug: false,
    electronArgs: [],
}
