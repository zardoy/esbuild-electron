/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable unicorn/no-await-expression-member */
/* eslint-disable @typescript-eslint/naming-convention */
import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { getGithubRemoteInfo } from 'github-remote-info'
import { build, context, type BuildOptions } from 'esbuild'
import { lilconfig } from 'lilconfig'
import { mergeDeepRight } from 'rambda'
import { startElectron } from './electron-start'
import { type ElectronEsbuildConfig, defaultConfig } from './config'

const esbuildDefineEnv = (env: Record<string, string>) => {
    const definedEnv: Record<any, string> = {}
    for (const [name, val] of Object.entries(env)) {
        if (val === undefined) continue
        definedEnv[`process.env.${name}`] = JSON.stringify(val)
    }

    return definedEnv
}

function mergeConfigs<T extends Record<string, any>>(base: T, ...configs: Array<Partial<T>>): T {
    return configs.reduce((acc, config) => mergeDeepRight(acc, config), base) as T
}

export const main = async (options: Partial<ElectronEsbuildConfig>) => {
    const userConfig = ((await lilconfig('electron-esbuild').search())?.config ?? {}) as Partial<ElectronEsbuildConfig>
    const config = mergeConfigs(defaultConfig, options, userConfig) as Required<ElectronEsbuildConfig>

    let {
        mode,
        prodMinification,
        outdir,
        outdirProduction,
        entryPoints: entryPointsUnmerged = {},
        esbuildOptions: esbuildOptionsConfig,
        esbuildOptionsProduction: esbuildOptionsProductionConfig,
        vitePublicDir = './src/react/public',
        debug,
        electronArgs = [],
        autoRestart = true,
    } = config

    if (mode === 'production') {
        Object.assign(esbuildOptionsConfig, esbuildOptionsProductionConfig)
    }

    const outputDir = mode === 'production' ? outdirProduction : outdir

    const githubRepo = await getGithubRemoteInfo(process.cwd()).catch(() => undefined)
    const getPath = <K extends { base: string } & Record<any, string>>(paths: K, component: keyof K) => resolve(process.cwd(), paths.base, paths[component]!)

    const inputPaths = {
        base: 'src/electron',
        main: 'index.ts',
        preload: 'preload.ts',
        ...entryPointsUnmerged,
    }

    const esbuildBaseOptions: BuildOptions = {
        bundle: true,
        platform: 'node',
        ...esbuildOptionsConfig,
        define: esbuildDefineEnv({
            GITHUB_REPO_URL: githubRepo ? `https://github.com/${githubRepo.owner}/${githubRepo.name}` : '',
            ...esbuildOptionsConfig?.define,
        }),
        external: ['electron', 'original-fs', ...(esbuildOptionsConfig?.external ?? [])],
    }

    const { default: exitHook } = await import('exit-hook')

    // Set up stdin for restart functionality in dev mode
    if (mode === 'dev') {
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.setEncoding('utf8')

        // Handle Ctrl+C and restart
        process.stdin.on('data', async (key: string) => {
            if (key === '\u0003') {
                // Ctrl+C
                console.log('\n🛑 Stopping Electron process...')
                currentStop?.()
                process.exit()
            } else if (key === 'r') {
                console.log('🔄 Restarting Electron process...')
                currentStop?.()
                shouldAutoRestart = true
                // Immediately restart Electron
                ;[, currentStop] = await startElectron({
                    path: join(outputDir, 'index.js'),
                    args: [...electronArgs, ...(debug ? ['--inspect'] : [])],
                })
            }
        })
    }

    let currentStop: (() => void) | undefined
    let shouldAutoRestart = true

    // main script
    const preloadPath = getPath(inputPaths, 'preload')
    const esbuildOptions: BuildOptions = {
        entryPoints: [getPath(inputPaths, 'main'), ...(existsSync(preloadPath) ? [preloadPath] : [])],
        outdir: outputDir,
        minify: mode === 'production' && prodMinification,
        metafile: true,
        logLevel: 'info',
        sourcemap: debug || undefined,
        keepNames: debug || undefined,
        ...esbuildBaseOptions,
        define: {
            'process.env.VITE_PUBLIC_DIR': JSON.stringify(resolve(vitePublicDir)),
            'process.env.DEV': JSON.stringify(mode === 'dev'),
            'process.env.NODE_ENV': JSON.stringify(mode === 'dev' ? 'development' : 'production'),
            'import.meta': JSON.stringify('{env: {}}'),
            ...esbuildBaseOptions.define,
        },
        plugins: [
            {
                name: 'build-end-watch',
                setup(build) {
                    let rebuildCount = 0
                    exitHook(() => {
                        currentStop?.()
                    })

                    if (mode === 'dev') {
                        // Handle stdin for restart
                        // process.stdin.on('data', (key: string) => {
                        //     if (key === 'r') {
                        //         console.log('🔄 Restarting Electron process...')
                        //         currentStop?.()
                        //         shouldAutoRestart = true
                        //     }
                        // })

                        build.onEnd(async ({ errors }) => {
                            if (errors.length > 0) return

                            // Only auto-restart if enabled and shouldAutoRestart is true
                            if (!autoRestart && !shouldAutoRestart) return

                            currentStop?.()
                            ;[, currentStop] = await startElectron({
                                path: join(outputDir, 'index.js'),
                                args: [...electronArgs, ...(debug ? ['--inspect'] : [])],
                            })

                            // After auto-restart, set flag to false if autoRestart is disabled
                            if (!autoRestart) {
                                shouldAutoRestart = false
                            }

                            rebuildCount++
                        })
                    }
                },
            },
            nativeNodeModulesPlugin,
            ...(esbuildBaseOptions.plugins ?? []),
        ],
    }

    await (mode === 'dev' ? (await context(esbuildOptions)).watch() : build(esbuildOptions))

    // Cleanup stdin listeners when done
    if (mode === 'dev') {
        exitHook(() => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
        })
    }
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
