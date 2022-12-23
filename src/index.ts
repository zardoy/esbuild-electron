/* eslint-disable unicorn/no-await-expression-member */
/* eslint-disable @typescript-eslint/naming-convention */
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { getGithubRemoteInfo } from 'github-remote-info'

import { build, BuildOptions } from 'esbuild'
import execa from 'execa'
import { lilconfig } from 'lilconfig'
import { mergeDeepRight } from 'rambda'
import { startElectron } from './electron-start'

type EmptyFn = () => unknown
interface Options {
    /** `development` will start watching */
    mode: 'dev' | 'production'
    /** @default true disable for debugging prod build */
    prodMinification?: boolean
    // onFirstBuild?: EmptyFn
    // /** Also fired on first build with i = 0 */
    // onEveryBuild?: (i: number) => unknown
    /** Preload script to build seperately from main. Pass `null` to disable
    //  * @default ./electron-out/index.js */
    // preloadScript?: string | null

    /** Path to executable @default electron (global or local electron) */
    // electronExecutable?: string
    electronArgs?: string[]
    /** @default node_modules/.electron-esbuild */
    outdir?: string
    entryPoints?: {
        /** @default src/electron (relative from cwd) */
        base?: string
        /** @default index.ts */
        main?: string
        /** @default preload.ts */
        preload?: string
    }
    esbuildOptions?: Partial<BuildOptions>
    vitePublicDir?: string
    debug?: boolean
}

export interface Env {
    NODE_ENV: Options['mode']
    /** Note that by default `undefined` only in non-GitHub projects */
    GITHUB_REPO_URL?: string
}

const esbuildDefineEnv = (env: Env) => {
    // TODO use lodash-lib
    const definedEnv: Record<any, string> = {}
    for (const [name, val] of Object.entries(env)) {
        if (val === undefined) continue
        definedEnv[`process.env.${name}`] = JSON.stringify(val)
    }

    return definedEnv
}

export const main = async (options: Options) => {
    const userConfig: Options = (await lilconfig('electron-esbuild').search())?.config ?? {}

    const {
        mode = 'dev',
        // onEveryBuild,
        // onFirstBuild,
        prodMinification = true,
        outdir = 'node_modules/.electron-esbuild',

        entryPoints: entryPointsUnmerged = {},
        esbuildOptions,
        vitePublicDir = './src/react/public',
        debug = false,
        electronArgs = [],
    }: Options = mergeDeepRight(options, userConfig)

    const githubRepo = await getGithubRemoteInfo(process.cwd()).catch(() => undefined)
    const getPath = <K extends { base: string } & Record<any, string>>(paths: K, component: keyof K) => resolve(process.cwd(), paths.base, paths[component]!)
    const base = 'src/electron'
    const inputPaths = {
        base,
        main: 'index.ts',
        preload: 'preload.ts',
        ...entryPointsUnmerged,
    }

    const esbuildBaseOptions: BuildOptions = {
        bundle: true,
        platform: 'node',
        ...esbuildOptions,
        define: esbuildDefineEnv({
            NODE_ENV: mode,
            GITHUB_REPO_URL: githubRepo && `https://github.com/${githubRepo.owner}/${githubRepo.name}`,
            ...esbuildOptions?.define,
        }),
        external: ['electron', 'original-fs', ...(esbuildOptions?.external ?? [])],
    }

    const { default: exitHook } = await import('exit-hook')
    // main script
    const preloadPath = getPath(inputPaths, 'preload')
    const result = await build({
        entryPoints: [getPath(inputPaths, 'main'), ...(existsSync(preloadPath) ? [preloadPath] : [])],
        outdir,
        watch: mode === 'dev',
        minify: mode === 'production' && prodMinification,
        metafile: true,
        logLevel: 'info',
        sourcemap: debug || undefined,
        keepNames: debug || undefined,
        ...esbuildBaseOptions,
        define: {
            'process.env.VITE_PUBLIC_DIR': JSON.stringify(resolve(vitePublicDir)),
            'process.env.DEV': JSON.stringify(mode === 'dev'),
            'import.meta': JSON.stringify('{env: {}}'),
            ...esbuildBaseOptions.define,
        },
        plugins: [
            {
                name: 'build-end-watch',
                setup(build) {
                    let rebuildCount = 0
                    let stopPrev: (() => void) | undefined
                    exitHook(() => {
                        stopPrev?.()
                    })
                    if (mode !== 'dev') return
                    build.onEnd(async ({ errors }) => {
                        if (errors.length > 0) return
                        stopPrev?.()
                        ;[, stopPrev] = await startElectron({
                            path: join(outdir, 'index.js'),
                            args: [...electronArgs, ...(debug ? ['--inspect'] : [])],
                        })
                        // TODO review and compare with electron forge and electron-run

                        rebuildCount++
                    })
                },
            },
            nativeNodeModulesPlugin,
            ...(esbuildBaseOptions.plugins ?? []),
        ],
    })
}

const nativeNodeModulesPlugin = {
    name: 'native-node-modules',
    setup(build) {
        // If a ".node" file is imported within a module in the "file" namespace, resolve
        // it to an absolute path and put it into the "node-file" virtual namespace.
        build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => ({
            path: require.resolve(args.path, { paths: [args.resolveDir] }),
            namespace: 'node-file',
        }))

        // Files in the "node-file" virtual namespace call "require()" on the
        // path from esbuild of the ".node" file in the output directory.
        build.onLoad({ filter: /.*/, namespace: 'node-file' }, args => ({
            contents: `
        import path from ${JSON.stringify(args.path)}
        try { module.exports = require(path) }
        catch {}
      `,
        }))

        // If a ".node" file is imported within a module in the "node-file" namespace, put
        // it in the "file" namespace where esbuild's default loading behavior will handle
        // it. It is already an absolute path since we resolved it to one above.
        build.onResolve({ filter: /\.node$/, namespace: 'node-file' }, args => ({
            path: args.path,
            namespace: 'file',
        }))

        // Tell esbuild's default loading behavior to use the "file" loader for
        // these ".node" files.
        const opts = build.initialOptions
        opts.loader = opts.loader || {}
        opts.loader['.node'] = 'file'
    },
}
