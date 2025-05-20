const path = require('path')

module.exports = {
  configureWebpack: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@services': path.resolve(__dirname, 'src/services')
      }
    }
  }
}