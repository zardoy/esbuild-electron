/// <reference types="node" />
import childProcess from 'child_process';
export declare function startElectron({ path, silent, args }: {
    path: any;
    silent?: boolean | undefined;
    args?: string[] | undefined;
}): Promise<readonly [childProcess.ChildProcessWithoutNullStreams, () => void]>;
