import path from 'path'
import electronIsDev from 'electron-is-dev'

// eslint-disable-next-line import/no-mutable-exports, prefer-const
export let compiledAssetsPath = 'dist'

/**
 * Get path to asset, which you should keep in public/ directory
 *
 * @param pathToFile relative path to file from public/
 */
export const getFileFromPublic = (pathToFile: string): string => {
    if (electronIsDev) return path.join(process.env.VITE_PUBLIC_DIR!, pathToFile)

    // todo explain
    return path.join(__dirname, compiledAssetsPath, pathToFile)
}

export const getMainPageUrl = (devPortOrUrl: string | number = 3500) => {
    let host = process.env.HOST ?? 'localhost'
    if (!host.startsWith('http')) host = `http://${host}`
    const devUrl = typeof devPortOrUrl === 'string' ? devPortOrUrl : `${host}:${devPortOrUrl}`
    return electronIsDev ? devUrl : `file://${getFileFromPublic('index.html')}`
}
