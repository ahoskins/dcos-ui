var config = require('./.build.config');
var path = require('path');
var webpack = require('webpack');

var webpackDevtool = 'source-map';
var webpackWatch = false;
if (process.env.NODE_ENV === 'development' ||
  process.env.NODE_ENV === 'testing') {
  // eval-source-map is the same thing as source-map,
  // except with caching. Don't use in production.
  webpackDevtool = 'eval-source-map';
  webpackWatch = true;
}

var pluginsList = {};
try {
  pluginsList = require('./plugins/index');
} catch (err) {
  console.warn('Could not find an index file in plugins directory listing available plugins');
}

var pluginEntryPoints = Object.keys(pluginsList).map(function (pluginID) {
  return path.resolve(__dirname, 'plugins', pluginsList[pluginID]);
});

var vendors = [
  'classnames',
  'cookie',
  'd3',
  'flux',
  'less-color-lighten',
  'md5',
  'mesosphere-shared-reactjs',
  'moment',
  'query-string',
  'react',
  'react-addons-css-transition-group',
  'react-addons-test-utils',
  'react-dom',
  'react-gemini-scrollbar',
  'react-redux',
  'react-router',
  'react-zeroclipboard',
  'reactjs-components',
  'reactjs-mixin',
  'redux',
  'underscore',
  'zeroclipboard'
];

/**
 * Build into 3 chunks to make use of parallel download.
 */

module.exports = {
  devtool: webpackDevtool,
  entry: {
    index: [config.files.srcJS].concat(pluginEntryPoints),
    vendor: vendors
  },
  output: {
    path: config.dirs.dist,
    filename: '[name].js'
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin('vendor', 'vendor.js', Infinity)
  ],
  module: {
    loaders: [{
      exclude: /node_modules/,
      loader: 'babel-loader',
      query: {
        cacheDirectory: true
      },
      test: /\.js$/
    },
    { test: /\.json$/, loader: 'json-loader' }],
    preLoaders: [{
      test: /\.js$/,
      loader: 'source-map-loader',
      exclude: /node_modules/
    }],
    postLoaders: [{
      loader: 'transform/cacheable?envify'
    }]
  },
  resolve: {
    root: path.resolve(__dirname),
    extensions: ['', '.js'],
    alias: {
      PluginSDK: 'src/js/pluginBridge/PluginSDK',
      PluginTestUtils: 'src/js/pluginBridge/PluginTestUtils',
      StoreMixinConfig: 'src/js/utils/StoreMixinConfig'
    }
  },
  watch: webpackWatch
};
