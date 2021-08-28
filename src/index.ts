import { resolve } from 'path'
import { getGithubRemoteInfo } from 'github-remote-info'

import { build, BuildOptions } from 'esbuild'
import execa from 'execa'

type EmptyFn = () => unknown
interface Options {
    /** `development` will start watching */
    mode: 'development' | 'production'
    /** @default true disable for debugging prod build */
    prodMinification?: boolean
    // onFirstBuild?: EmptyFn
    // /** Also fired on first build with i = 0 */
    // onEveryBuild?: (i: number) => unknown
    /** Preload script to build seperately from main. Pass `null` to disable
    //  * @default ./electron-out/index.js */
    // preloadScript?: string | null

    /** Path to executable @default electron (global or local electron) */
    electronExecutable?: string
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

export const main = async ({
    mode,
    // onEveryBuild,
    // onFirstBuild,
    prodMinification = true,
    outdir = 'node_modules/.electron-esbuild',
    electronExecutable = 'electron',
    entryPoints: entryPointsUnmerged = {},
}: Options) => {
    const githubRepo = await getGithubRemoteInfo(process.cwd())
    const inputPaths = {
        base: 'src/electron',
        main: 'index.ts',
        preload: 'preload.ts',
        ...entryPointsUnmerged,
    }

    const getPath = <K extends { base: string } & Record<any, string>>(paths: K, component: keyof K) =>
        resolve(process.cwd(), paths.base, paths[component]!)

    const esbuildBaseOptions: BuildOptions = {
        bundle: true,
        platform: 'node',
        define: esbuildDefineEnv({
            NODE_ENV: mode,
            GITHUB_REPO_URL: githubRepo && `https://github.com/${githubRepo.owner}/${githubRepo.name}`,
        }),
        external: ['electron', 'original-fs'],
    }

    // main script
    const result = await build({
        entryPoints: [getPath(inputPaths, 'main'), getPath(inputPaths, 'preload')],
        outdir: outdir,

        watch: mode === 'development',
        minify: mode === 'production' && prodMinification,
        ...esbuildBaseOptions,
        plugins: [
            {
                name: 'build-end-watch',
                setup(build) {
                    let rebuildCount = 0
                    let electronProcess: execa.ExecaChildProcess
                    if (mode !== 'development') return
                    build.onEnd(() => {
                        // pretend we are launching electron from cli or npm script
                        // TODO review and compare with electron forge and electron-run
                        if (electronProcess !== undefined) electronProcess.kill()

                        electronProcess = execa(electronExecutable, [], {
                            detached: true,
                        })
                        rebuildCount++
                    })
                },
            },
        ],
    })
}
