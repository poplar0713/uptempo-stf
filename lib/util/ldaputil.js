var util = require('util')

var ldap = require('ldapjs')
var Promise = require('bluebird')
const { assert } = require('console')
//soyeong edit 0728
var logger = require('./logger')
const bkfd2Password = require('pbkdf2-password')
const { resolve } = require('bluebird')
var hasher = bkfd2Password(); 
//soyeong edit end 0728


function InvalidCredentialsError(user) {
  Error.call(this, util.format('Invalid credentials for user "%s"', user))
  this.name = 'InvalidCredentialsError'
  this.user = user
  Error.captureStackTrace(this, InvalidCredentialsError)
}

util.inherits(InvalidCredentialsError, Error)

// Export
module.exports.InvalidCredentialsError = InvalidCredentialsError

// Export
module.exports.login = function(options, username, password) {
  var log = logger.createLogger('auth-ldap-edit-PW')

  function tryConnect() {
    var resolver = Promise.defer()
    var client = ldap.createClient({
          url: options.url
        , timeout: options.timeout
        , maxConnections: 1
        })
    if (options.bind.dn) {
      client.bind(options.bind.dn, options.bind.credentials, function(err) {
        if (err) {
          resolver.reject(err)
        }
        else {
          resolver.resolve(client)
        }
      })
    }
    else {
      resolver.resolve(client)
    }

    return resolver.promise
  }

  function tryFind(client) {
    var resolver = Promise.defer()
    var query = {
          scope: options.search.scope
        , filter: new ldap.AndFilter({
            filters: [
              new ldap.EqualityFilter({
                attribute: 'objectClass'
              , value: options.search.objectClass
              })
            , new ldap.EqualityFilter({
                attribute: options.search.field
              , value: username
              })
            ]
          })
        }

    if (options.search.filter) {
      var parsedFilter = ldap.parseFilter(options.search.filter)
      query.filter.filters.push(parsedFilter)
    }

    client.search(options.search.dn, query, function(err, search) {
      if (err) {
        return resolver.reject(err)
      }

      function entryListener(entry) {
        resolver.resolve(entry)
      }

      function endListener() {
        resolver.reject(new InvalidCredentialsError(username))
      }

      function errorListener(err) {
        resolver.reject(err)
      }

      search.on('searchEntry', entryListener)
      search.on('end', endListener)
      search.on('error', errorListener)

      resolver.promise.finally(function() {
        search.removeListener('searchEntry', entryListener)
        search.removeListener('end', endListener)
        search.removeListener('error', errorListener)
      })
    })

    return resolver.promise
  }
  function hashedInputPw(entry){
    var resolver = Promise.defer()
    
    if(entry.object.st==undefined){
      resolver.resolve(password)
    }else{
      hasher({password:password,salt:entry.object.st}, function(err,pass,salt,hash){
        if(err){
          log.info(err)
          resolver.resolve(err)
        }else{
          password = hash
          resolver.resolve(password)
        }
      })
    }
    
    return resolver.promise
  }

  function tryBind(client, entry) {
    return new Promise(function(resolve, reject) {
      client.bind(entry.object.dn, password, function(err) {
        if (err) {
          reject(new InvalidCredentialsError(username))
        }
        else {
          resolve(entry.object)
        }
      })
    })
  }

  return tryConnect().then(function(client) {
    return tryFind(client)
      .then(function(entry) {
        return hashedInputPw(entry)
          .then(function(){
            return tryBind(client, entry)
          })
        
      })
      .finally(function() {
        client.unbind()
      })
  })
}

// Export
module.exports.email = function(user) {
  return user.mail || user.email || user.userPrincipalName
}

//pw edit
module.exports.editPw = function(options, username, password){
  var log = logger.createLogger('auth-ldap-edit-PW')
  
  function tryConnect() {
    var resolver = Promise.defer()
    var client = ldap.createClient({
          url: options.url
        , timeout: options.timeout
        , maxConnections: 1
        })

    if (options.bind.dn) {
      client.bind(options.bind.dn, options.bind.credentials, function(err) {
        if (err) {
          resolver.reject(err)
        }
        else {
          resolver.resolve(client)
        }
      })
    }
    else {
      resolver.resolve(client)
    }

    return resolver.promise
  }

  function tryFind(client) {
    var resolver = Promise.defer()
    var query = {
          scope: options.search.scope
        , filter: new ldap.AndFilter({
            filters: [
              new ldap.EqualityFilter({
                attribute: 'objectClass'
              , value: options.search.objectClass
              })
            , new ldap.EqualityFilter({
                attribute: options.search.field
              , value: username
              })
            ]
          })
        }

    if (options.search.filter) {
      var parsedFilter = ldap.parseFilter(options.search.filter)
      query.filter.filters.push(parsedFilter)
    }

    client.search(options.search.dn, query, function(err, search) {
      if (err) {
        return resolver.reject(err)
      }

      function entryListener(entry) {
        resolver.resolve(entry)
      }

      function endListener() {
        resolver.reject(new InvalidCredentialsError(username))
      }

      function errorListener(err) {
        resolver.reject(err)
      }

      search.on('searchEntry', entryListener)
      search.on('end', endListener)
      search.on('error', errorListener)

      resolver.promise.finally(function() {
        search.removeListener('searchEntry', entryListener)
        search.removeListener('end', endListener)
        search.removeListener('error', errorListener)
      })
    })

    return resolver.promise
  }

  function hashPw(){
    var resolver = Promise.defer()
    hasher({password:password},function(err,pass,salt,hash){
      if(err){
        log.info(err)
        resolver.resolve(err)
      }else{
        password = hash;
        resolver.resolve(salt)
      }
    })
    return resolver.promise
  }

  function tryModify(client, entry,salt) {
    
    var changePw = new ldap.Change({
      operation:'replace',
      modification:{
        userpassword: password
      }
    })

    var changeSt = new ldap.Change({
      operation:'replace',
      modification:{
        st:salt
      }
    })
    return new Promise(function(resolve, reject){
      client.modify(entry.object.dn, changePw, function(err){
        if(err){
          log.info(err)
          reject(new InvalidCredentialsError(username))
        }else {
          client.modify(entry.object.dn, changeSt, function(err){
            if(err){
              log.info(err)
              reject(new InvalidCredentialsError(username))
            }else {
              resolve(entry.object)
            }
          })
        }
      })
      
    })
    
  }

  return tryConnect().then(function(client) {
    return tryFind(client)
      .then(function(entry) {
        return hashPw()
        .then(function(salt){
          return tryModify(client, entry,salt)
        })
        
      })
      .finally(function() {
        client.unbind()
      })
      
  })
}

//add new user
module.exports.join = function(options, username, password, mail){
  var log = logger.createLogger('auth-ldap-join')
  function tryConnect(){
    var resolver = Promise.defer()
    var client = ldap.createClient({
      url:options.url
      , timeout:options.timeout
      , maxConnections: 1
    })
    if(options.bind.dn){
      client.bind(options.bind.dn, options.bind.credentials,function(err){
        if(err){
          resolver.reject(err)
        }else{
          resolver.resolve(client)
        }
      })
    }else{
      resolver.resolve(client)
    }
    return resolver.promise
  }

  function emailCheck(client){
    var resolver = Promise.defer()
    var opts = {
      filter: new ldap.AndFilter({
        filters: [
          new ldap.EqualityFilter({
            attribute: 'objectClass'
          , value: options.search.objectClass
          })
        , new ldap.EqualityFilter({
            attribute: 'mail'
          , value: mail
          })
        ]
      }),
      scope:'sub',
    }
    client.search(options.search.dn,opts,function(err,search){
      if (err) {
        return resolver.reject(err)
      }

      //entry existed --> email existed
      function entryListener(entry) {
        resolver.reject(new InvalidCredentialsError(true))
      }

      //entry not existed --> eamil ok!!
      function endListener() {
        resolver.resolve(false)
      }

      function errorListener(err) {
        resolver.reject(err)
      }

      search.on('searchEntry', entryListener)
      search.on('end', endListener)
      search.on('error', errorListener)

      resolver.promise.finally(function() {
        search.removeListener('searchEntry', entryListener)
        search.removeListener('end', endListener)
        search.removeListener('error', errorListener)
      })
    })
    return resolver.promise
  }

  function hashPw(){
    var resolver = Promise.defer();
    
    hasher({password:password},function(err,pass,salt,hash){
      if(err){
        resolver.resolve(err)
      }else{
        password = hash
        resolver.resolve(salt)
      }
    })
    return resolver.promise
  }

  function tryAdd(client, salt){
    var newUserEntry = {
      cn: username,
      sn: username,
      uid: username,
      mail: mail,
      userpassword: password,
      st: salt,
      objectClass: ['top','inetOrgPerson']
    }
    
    return new Promise(function(resolve,reject){
      client.add('CN='+username+','+options.search.dn, newUserEntry, function(err){
        if(err){

          if(err instanceof ldap.EntryAlreadyExistsError){
            reject(new ldap.EntryAlreadyExistsError())
          }else{
            reject(new InvalidCredentialsError(username))
          }
        }else{
          resolve(username)
        }
      })
    })
  }

  return tryConnect().then(function(client){
    return  hashPw()
      .then(function(salt){
        return emailCheck(client)
          .then(function(isExistedMail){
            if(!isExistedMail){
              return tryAdd(client,salt)
            }
          })
      })
      .finally(function(){
        client.unbind()
      })
  })
}
