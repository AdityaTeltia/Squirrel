const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/content-script': './src/content/content-script.ts',
    'ui/popup/popup': './src/ui/popup/popup.ts',
    'ui/search/search': './src/ui/search/search.ts',
    'ui/options/options': './src/ui/options/options.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [{
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: {
              noEmit: false
            }
          }
        }],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'src/ui/popup/popup.html', to: 'ui/popup/popup.html' },
        { from: 'src/ui/popup/popup.css', to: 'ui/popup/popup.css' },
        { from: 'src/ui/search/search.html', to: 'ui/search/search.html' },
        { from: 'src/ui/search/search.css', to: 'ui/search/search.css' },
        { from: 'src/ui/options/options.html', to: 'ui/options/options.html' },
        { from: 'src/ui/options/options.css', to: 'ui/options/options.css' },
        { from: 'icons', to: 'icons' }
      ]
    })
  ],
  optimization: {
    minimize: false
  }
};

