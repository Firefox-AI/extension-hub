const path = require('path')
const Dotenv = require('dotenv-webpack')

module.exports = {
  mode: 'development',
  entry: {
    api: {
      import: './src/api.ts',
      library: {
        export: 'default',
        name: 'extensionHub',
        type: 'this',
      },
    },
    content: './src/content.ts',
    sidebar: './src/sidebar.ts',
    background: './src/background.ts',
    settings: './src/settings.ts',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'cheap-module-source-map',
  plugins: [
    new Dotenv({
    }),
  ],
}
