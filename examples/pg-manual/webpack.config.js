const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

const dist = path.resolve(__dirname, 'dist')
const webpackMode = 'development'

module.exports = {
    name: 'examples',
    mode: webpackMode,
    entry: {
        string: './examples/string.js',
        file: './examples/file.js',
    },
    output: {
        path: dist,
        filename: '[name].js',
    },
    experiments: {
        asyncWebAssembly: true,
        topLevelAwait: true,
    },
    devServer: {
        compress: true,
        port: 9000,
    },
    resolve: {
        fallback: {
            https: require.resolve('https-browserify'),
            http: require.resolve('stream-http'),
            url: require.resolve('url/'),
            util: require.resolve('util/'),
            events: false,
        },
        // No `modules: [<abs>/node_modules]` here. Pinning resolution to this one
        // directory only worked because npm's flat layout hoisted every transitive
        // dependency into it. In the workspace, pnpm gives each package its own
        // scope, so `@privacybydesign/yivi-client` resolves `deepmerge` from
        // `.pnpm/…/yivi-client/node_modules` — a path an absolute `modules` entry
        // excludes, which fails the build with three "Module not found" errors even
        // though every one of those dependencies is correctly declared. webpack's
        // default walks up from each module's own directory, which is what pnpm
        // needs.
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            filename: 'string.html',
            template: './examples/string.html',
            chunks: ['string'],
        }),
        new HtmlWebpackPlugin({
            filename: 'file.html',
            template: './examples/file.html',
            chunks: ['file'],
        }),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: './index.html',
        }),
    ],
}
