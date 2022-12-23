"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startElectron = void 0;
// eslint-ignore
const child_process_1 = __importDefault(require("child_process"));
const stream_1 = __importDefault(require("stream"));
const utils = __importStar(require("electron-run/build/main/src/utils"));
const electron = require('electron');
const stopList = [];
let exitByScripts = false;
//@ts-ignore
let chalk;
async function startElectron({ path, silent = false, args = [] }) {
    chalk !== null && chalk !== void 0 ? chalk : (chalk = await import('chalk'));
    for (const stop of stopList) {
        stop();
    }
    const electronProcess = child_process_1.default.spawn(electron, [path !== null && path !== void 0 ? path : '', '--color', ...args]);
    electronProcess.on('exit', code => {
        if (!exitByScripts) {
            console.log(chalk.default.gray(`Electron exited with code ${code}`));
            process.exit();
        }
        exitByScripts = true;
    });
    function createStop() {
        let called = false;
        return () => {
            if (!called && electronProcess) {
                electronProcess.removeAllListeners();
                try {
                    process.kill(electronProcess.pid);
                }
                catch (err) {
                    console.warn('Failed to kill electron: ', err.message);
                }
                exitByScripts = true;
            }
            called = true;
        };
    }
    const stop = createStop();
    stopList.push(stop);
    if (!silent) {
        const removeElectronLoggerJunkOut = new stream_1.default.Transform(utils.removeJunkTransformOptions);
        const removeElectronLoggerJunkErr = new stream_1.default.Transform(utils.removeJunkTransformOptions);
        electronProcess.stdout.pipe(removeElectronLoggerJunkOut).pipe(process.stdout);
        electronProcess.stderr.pipe(removeElectronLoggerJunkErr).pipe(process.stderr);
    }
    return [electronProcess, stop];
}
exports.startElectron = startElectron;
