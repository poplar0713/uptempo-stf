var syrup = require('syrup')

var logger = require('../../../util/logger')
var wire = require('../../../wire')
var wireutil = require('../../../wire/util')

module.exports = syrup.serial()
  .dependency(require('./service'))
  .dependency(require('../support/router'))
  .dependency(require('../support/push'))
  .define(function(options, service, router, push) {
    var log = logger.createLogger('device:plugins:wifi')

    router.on(wire.WifiSetEnabledMessage, function(channel, message) {
      var reply = wireutil.reply(options.serial)

      log.info('Setting Wifi "%s"', message.enabled)

      service.setWifiEnabled(message.enabled)
        .timeout(30000)
        .then(function() {
          push.send([
            channel
          , reply.okay()
          ])
        })
        .error(function(err) {
          log.error('Setting wifi enabled failed', err.stack)
          push.send([
            channel
          , reply.fail(err.message)
          ])
        })
    })
  })