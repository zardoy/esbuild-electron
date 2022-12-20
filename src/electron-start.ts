// eslint-ignore
import childProcess from 'child_process'
import stream from 'stream'
import * as utils from 'electron-run/build/main/src/utils'

const electron = require('electron')
const stopList: (() => void)[] = []
let exitByScripts = false
//@ts-ignore
let chalk: typeof import('chalk')
export async function startElectron({ path, silent = false, args = [] as string[] }) {
    chalk ??= await import('chalk')
    for (const stop of stopList) {
        stop()
    }
    const electronProcess = childProcess.spawn(electron, [path !== null && path !== void 0 ? path : '', '--color', ...args])
    electronProcess.on('exit', code => {
        if (!exitByScripts) {
            console.log(chalk.default.gray(`Electron exited with code ${code}`))
            process.exit()
        }
        exitByScripts = true
    })
    function createStop() {
        let called = false
        return () => {
            if (!called && electronProcess) {
                electronProcess.removeAllListeners()
                try {
                    process.kill(electronProcess.pid!)
                } catch (err) {
                    console.warn('Failed to kill electron: ', err.message)
                }
                exitByScripts = true
            }
            called = true
        }
    }
    const stop = createStop()
    stopList.push(stop)
    if (!silent) {
        const removeElectronLoggerJunkOut = new stream.Transform(utils.removeJunkTransformOptions)
        const removeElectronLoggerJunkErr = new stream.Transform(utils.removeJunkTransformOptions)
        electronProcess.stdout.pipe(removeElectronLoggerJunkOut).pipe(process.stdout)
        electronProcess.stderr.pipe(removeElectronLoggerJunkErr).pipe(process.stderr)
    }
    return [electronProcess, stop] as const
}
