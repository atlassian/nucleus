const path = require('path');
const webpack = require('webpack');

const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');
const DashboardPlugin = require('webpack-dashboard/plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const loaders = require('./webpack.loaders');

const HOST = process.env.NUCLEUS_HOST || '127.0.0.1';
const PORT = process.env.NUCLEUS_PORT || '8888';

let mainPort = 3030;
try {
  mainPort = require('./config.js').port
} catch (err) {

}

module.exports = {
  entry: [
    'react-hot-loader/patch',
    './public/index.tsx',
  ],
  devtool: process.env.WEBPACK_DEVTOOL || 'eval-source-map',
  output: {
    publicPath: '/',
    path: path.join(__dirname, 'public_out'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    loaders,
  },
  devServer: {
    contentBase: './public_out',
    // do not print bundle build stats
    noInfo: true,
    // enable HMR
    hot: true,
    // embed the webpack-dev-server runtime into the bundle
    inline: true,
    // serve index.html in place of 404 responses to allow HTML5 history
    historyApiFallback: true,
    port: PORT,
    host: HOST,
    proxy: {
      '/rest': `http://localhost:${mainPort}`
    }
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new DashboardPlugin(),
    new HtmlWebpackPlugin({
      template: './public/template.html',
      title: 'Nucleus',
    }),
    new FaviconsWebpackPlugin({
      logo: path.resolve(__dirname, 'public/favicon.png'),
      background: '#0F4AA3'
    }),
  ],
};

if (process.env.ANALYZE) {
  module.exports.plugins.push(new BundleAnalyzerPlugin());
}
