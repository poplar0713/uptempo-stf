/**
* Copyright © 2019 contains code contributed by Orange SA, authors: Denis Barbaron - Licensed under the Apache license 2.0
**/

var http = require('http')

var express = require('express')
var validator = require('express-validator')
var cookieSession = require('cookie-session')
var bodyParser = require('body-parser')
var serveStatic = require('serve-static')
var csrf = require('csurf')
var csrfProtection = csrf({cookie: true})
var Promise = require('bluebird')
const path = require('path'); //2022.01.03 ykk

var logger = require('../../util/logger')
var requtil = require('../../util/requtil')
var ldaputil = require('../../util/ldaputil')
var jwtutil = require('../../util/jwtutil')
var pathutil = require('../../util/pathutil')
var urlutil = require('../../util/urlutil')
var lifecycle = require('../../util/lifecycle')

var nodemailer = require('nodemailer');

const dbapi = require('../../db/api')
const { EntryAlreadyExistsError } = require('ldapjs')

module.exports = function(options) {
  var log = logger.createLogger('auth-ldap')
  var app = express()
  var server = Promise.promisifyAll(http.createServer(app))


  lifecycle.observe(function() {
    log.info('Waiting for client connections to end')
    return server.closeAsync()
      .catch(function() {
        // Okay
      })
  })

  app.set('view engine', 'pug')
  app.set('views', pathutil.resource('auth/ldap/views'))
  app.set('strict routing', true)
  app.set('case sensitive routing', true)  
  app.engine('html', require('pug').renderFile); // 2201.03 ykk 

  app.use(cookieSession({
    name: options.ssid
  , keys: [options.secret]
  }))
  app.use(bodyParser.json())
  //app.use(csrf())
  app.use(validator())
  app.use('/static/bower_components',
    serveStatic(pathutil.resource('bower_components')))
  app.use('/static/auth/ldap', serveStatic(pathutil.resource('auth/ldap')))

  app.use(function(req, res, next) {
    //res.cookie('XSRF-TOKEN', req.csrfToken())
    next()
  })

  app.get('/',function(req,res){
    log.info('notxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  //  res.redirect('/home/')
  })

  app.get('/auth/ldap/join',function(req,res){
    log.info('good luck to you22')
    res.render('index');
  })
  //2022.01.03 ykk
 // app.get('/license/opensource',function(req,res){
    app.get('/auth/ldap/license',function(req,res){
      log.info('hihi license .....')
       //res.render('/license');
     //  res.sendFile(path.join(__dirname+'/license.html'));
     log.info ("process.env.path=" + process.env.path)
     log.info ("__dirname=" + __dirname)
     log.info ("_path.resolve(./)" + path.resolve("./"))
     //res.sendFile(path.join(path.resolve("./")+'/Downloads/apt/res/common/license/license.html')); // tb
     res.sendFile(path.join(path.resolve("./")+'/res/common/license/license.html')); // 
     //Error:  '/home/uptempo/Downloads/Up-Tempo/Up-Tempo/res/common/license/license.html'
       
  })
  





  app.get('/auth/',function(req,res){
    if(req.session && req.session.jwt){
      res.redirect('/')
      log.info('auth 1..........')
    }else{
      res.render('index')
      log.info('auth 2.......... why???')
    }
  })



  app.get('/auth/contact', function(req, res) {
    dbapi.getRootGroup().then(function(group) {
      res.status(200)
        .json({
          success: true
        , contact: group.owner
        })
    })
    .catch(function(err) {
      log.error('Unexpected error', err.stack)
      res.status(500)
        .json({
          success: false
        , error: 'ServerError'
        })
      })
  })

//terminal reservation mail send
  app.post('/auth/contact',function(req,res){
    var util = require('util')
    var sendId = req.body.contactEmail
    log.info(sendId);
    var transporter = nodemailer.createTransport({
      service:'gmail',
      auth:{
        user:sendId, //send id
        pass:'apptest0801!' //send pw
      }
    })
    var mailOptions ={
      from:sendId,
      to:sendId,
      subject:'예약하기 - 단말요청',
      text:util.format('%s 님이 %s 단말을 %s 시간부터 %d 만큼 예약을 요청했습니다',
      req.body.reserveUser,req.body.wantTerminal,req.body.reserveTime ,req.body.duration)
    }
    transporter.sendMail(mailOptions,function(err,info){
      if(err){
        log.info('error:' , err);
        res.status(200)
        .json({
          success: false
        })
      }else{
        log.info('Email sent: ' + info);
        res.status(400)
        .json({
          success: true
        })
      }
    })
  })

  //soyeong edit 0728
  app.get('/auth/ldap/mymodal',function(req,res){
    res.render('mymodal')
  })
  //soyeong edit end 0728
  app.get('/auth/ldap/', function(req, res) {
    res.render('index')
  })
  //soyeong edit 0728
  app.put('/auth/api/v1/ldap',function(req,res){  
    ldaputil.editPw(
      options.ldap
      , req.body.username
      , req.body.password
    )
    .then(function(user){
      res.status(200)
        .json({
          success: true
        })
    })
    .catch(requtil.ValidationError, function(err) {
      res.status(400)
        .json({
          success: false
        , error: 'ValidationError'
        , validationErrors: err.errors
        })
    })
    .catch(ldaputil.InvalidCredentialsError, function(err) {
      
      log.warn('Authentication failure for "%s"', err.user)
      res.status(400)
        .json({
          success: false
        , error: 'InvalidCredentialsError'
        })
    })
    .catch(function(err) {
      log.error('Unexpected error', err.stack)
      res.status(500)
        .json({
          success: false
        , error: 'ServerError'
        })
    })
  
  })
  //soyeong edit end 0728

  app.post('/auth/api/v1/ldap', function(req, res) {
    var log = logger.createLogger('auth-ldap')
    log.setLocalIdentifier(req.ip)
    switch (req.accepts(['json'])) {
      case 'json':
        requtil.validate(req, function() {
            req.checkBody('username').notEmpty()
            req.checkBody('password').notEmpty()
          })
          .then(function() {
            return ldaputil.login(
              options.ldap
            , req.body.username
            , req.body.password
            )
          })
          .then(function(user) {
            log.info('Authenticated "%s"', ldaputil.email(user))
            var token = jwtutil.encode({
              payload: {
                email: ldaputil.email(user)
              , name: user[options.ldap.username.field]
              }
            , secret: options.secret
            , header: {
                exp: Date.now() + 24 * 3600
              }
            })
            res.status(200)
              .json({
                success: true
              , redirect: urlutil.addParams(options.appUrl, {
                  jwt: token
                })
              })
          })
          .catch(requtil.ValidationError, function(err) {
            res.status(400)
              .json({
                success: false
              , error: 'ValidationError'
              , validationErrors: err.errors
              })
          })
          .catch(ldaputil.InvalidCredentialsError, function(err) {
            log.warn('Authentication failure for "%s"', err.user)
            res.status(400)
              .json({
                success: false
              , error: 'InvalidCredentialsError'
              })
          })
          .catch(function(err) {
            log.error('Unexpected error', err.stack)
            res.status(500)
              .json({
                success: false
              , error: 'ServerError'
              })
          })
        break
      default:
        res.send(406)
        break
    }
  })

  app.post('/auth/api/v1/ldap/join',function(req,res){
    var log = logger.createLogger('join-ldap')
    switch(req.accepts(['json'])){
      case 'json':
        ldaputil.join(
          options.ldap
          , req.body.username
          , req.body.password
          , req.body.mail
        )
        .then(function(username){
          log.info('New User Added %s', username)
          res.status(200)
            .json({
              success:true
              , redirect : '/'
            })
        })
        .catch(ldaputil.InvalidCredentialsError,function(err){ 
          if(err.user){
            log.warn('Already Existed Email')
            res.status(400)
            .json({
              success:false
              , error: 'AlreadyExistedEmailError'
            })
          }else{
            log.warn('Autentication failure for %s', err.user)
            res.status(400)
            .json({
              success:false
              , error: 'InvalideCredentialsError'
            })
          }
          

        })
        .catch(EntryAlreadyExistsError,function(err){ 
          log.warn('Already Existed User')
          res.status(400)
            .json({
              success:false
              , error: 'AlreadyExistedUserError'
            })

        })
        .catch(function(err){
          log.error('Unexpected error', err.stack)
          res.status(500)
            .json({
              success: false
              , error: 'ServerError'
            })
        })
      break
    default:
      res.send(406)
      break
    }
  })

  server.listen(options.port)
  log.info('Listening on port %d', options.port)
  
}


