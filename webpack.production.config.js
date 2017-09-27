const webpack = require('webpack');

const ExtractTextPlugin = require('extract-text-webpack-plugin');
const WebpackCleanupPlugin = require('webpack-cleanup-plugin');

const config = require('./webpack.config');

// Remove React Hot Loader Patch
config.entry.shift();

// Hash all JS assets
config.output.filename = 'core.[chunkhash].min.js';

// Remove devServer config
delete config.devServer;

// Remove NoEmitOnErrors, HotModuleReplacement and Dashboard plugins
config.plugins.shift();
config.plugins.shift();
config.plugins.shift();

// Remove source mapping
config.devtool = false;

// Add production plugins
config.plugins.unshift(
  new WebpackCleanupPlugin(),
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: '"production"',
    },
  }),
  new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      screw_ie8: true,
      drop_console: true,
      drop_debugger: true,
    },
  }),
  new ExtractTextPlugin({
    filename: '[contenthash].css',
    allChunks: true,
  }));

module.exports = config;