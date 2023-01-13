var http = require('http')

var express = require('express')
var httpProxy = require('http-proxy')

var logger = require('../../util/logger')

const cors = require('cors')

module.exports = function(options) {
  var log = logger.createLogger('poorxy')
  var app = express()
  var server = http.createServer(app)
  var proxy = httpProxy.createProxyServer()

  proxy.on('error', function(err) {
    log.error('Proxy had an error', err.stack)
  })

  app.set('strict routing', true)
  app.set('case sensitive routing', true)
  app.set('trust proxy', true)

  ;['/static/auth/*', '/auth/*'].forEach(function(route) {
    let corsOption = {
      'origin': ['http://61.74.187.4:3000', 'http://localhost:3000', 'http://61.74.187.4', 'http://61.74.187.24:3000', 'http://61.74.187.24', 'http://www.up-tempo.ktds.com', 'http://www.dev.up-tempo.ktds.com'],
      'credentials': true
    }
    app.use(cors(corsOption))
    app.all(route, function(req, res) {
      proxy.web(req, res, {
        target: options.authUrl
      })
    })
  })

  ;['/s/image/*'].forEach(function(route) {
    app.all(route, function(req, res) {
      proxy.web(req, res, {
        target: options.storagePluginImageUrl
      })
    })
  })

  ;['/s/apk/*'].forEach(function(route) {
    app.all(route, function(req, res) {
      proxy.web(req, res, {
        target: options.storagePluginApkUrl
      })
    })
  })

  ;['/s/*'].forEach(function(route) {
    app.all(route, function(req, res) {
      proxy.web(req, res, {
        target: options.storageUrl
      })
    })
  })

  ;['/api/*'].forEach(function(route) {
    app.all(route, function(req, res) {
      proxy.web(req, res, {
        target: options.apiUrl
      })
    })
  })
  let corsOption = {
    'origin': ['http://61.74.187.4:3000', 'http://61.74.187.4', 'http://61.74.187.24:3000', 'http://61.74.187.24', 'http://www.up-tempo.ktds.com', 'http://www.dev.up-tempo.ktds.com'],
    'credentials': true
  }
  app.use(cors(corsOption))
  app.use(function(req, res) {
    proxy.web(req, res, {
      target: options.appUrl
    })
  })

  server.listen(options.port)
  log.info('Listening on port %d', options.port)
}
