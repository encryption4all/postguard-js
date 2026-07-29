// Build config for `npm run check`. Separate from webpack.config.js so the
// probe never lands in dist/ and CleanWebpackPlugin never runs against it.
const path = require('path')

const root = path.resolve(__dirname, '..')

module.exports = {
    name: 'sdk-exports',
    mode: 'development',
    entry: path.resolve(__dirname, 'sdk-exports.js'),
    output: {
        path: path.resolve(root, 'node_modules/.cache/sdk-exports'),
        filename: 'sdk-exports.js',
    },
    experiments: {
        asyncWebAssembly: true,
        topLevelAwait: true,
    },
    resolve: {
        modules: [path.resolve(root, 'node_modules')],
    },
}
