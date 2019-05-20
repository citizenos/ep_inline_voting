'use strict'

var eejs = require('ep_etherpad-lite/node/eejs/');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var formidable = require('formidable');
var voteManager = require('./voteManager');
var votes = require('./votes');
var apiUtils = require('./apiUtils');

var voteOptions = [['Yes'], ['No']];

exports.padInitToolbar = function (hookName, args) {
    var toolbar = args.toolbar;

    var button = toolbar.button({
        command: 'createVote',
        localizationId: 'ep_inline_vote.create_vote',
        class: 'buttonicon commenticon'
    });

    toolbar.registerButton('createVote', button);
};

exports.eejsBlock_body = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_inline_voting/templates/vote.ejs", {
    options: voteOptions
  });
  return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
  args.content = args.content + eejs.require("ep_inline_voting/templates/styles.html", {}, module);
  return cb();
};

exports.socketio = function (hook_name, args, cb){
  var app = args.app;
  var io = args.io;
  var pushVote;
  var padVote = io;

  var commentSocket = io
  .of('/vote')
  .on('connection', function (socket) {

    socket.on('startVote', function (data, callback) {
      voteManager.startVote(data.padId, data, function (err, result) {
        if (err) console.error('Error', err);
        callback(null, result);
      });
    });

    socket.on('getVoteSettings', function (data, callback) {
      var padId = data.padId;
      var voteId = data.voteId;
      voteManager.getVote(padId, voteId, function (err, data) {
        if (err) console.error('Error', err);
        callback(null, data);
      });
    });

    socket.on('getVoteResult', function (data, callback) {
      var padId = data.padId;
      socket.join(padId);
      voteManager.getVoteResult(padId, data.voteId, function (err, result){
        if(err) console.error(err);
        callback(err, result);
      });
    });

    socket.on('getVotes', function (data, callback) {
      var padId = data.padId;
      socket.join(padId);
      voteManager.getVotes(padId, function (err, votes){
        callback(votes);
      });
    });

    // On add events
    socket.on('addVote', function (data, callback) {
      var padId = data.padId;
      var content = data;
      voteManager.addVote(padId, content, function (err, votes){
        socket.broadcast.to(padId).emit('pushAddVote', votes);
        callback(err, votes);
      });
    });

    // vote added via API
    socket.on('apiAddVotes', function (data) {
      var padId = data.padId;
      var voteIds = data.voteIds;
      var votes = data.votes;

      for (var i = 0, len = voteIds.length; i < len; i++) {
        socket.broadcast.to(padId).emit('pushAddVote', voteIds[i], votes[i]);
      }
    });

    socket.on('updateVoteSettings', function (data, callback) {
      var padId = data.padId;
      var voteId = data.voteId;
      var settings = data.settings;
      voteManager.updateVoteSettings(padId, voteId, settings, function (err, vote) {
        if (err) console.error('Error', err);
        callback(err, vote);
      });
    });

  });
};

exports.expressCreateServer = function (hook_name, args, callback) {
  args.app.get('/p/:pad/:rev?/votes', function(req, res) {
    var fields = req.query;
    // check the api key
  //  if(!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    var padIdReceived = apiUtils.sanitizePadId(req);

    votes.getPadVotes(padIdReceived, function(err, data) {
      if(err) {
        res.json({code: 2, message: "internal error", data: null});
      } else {
        res.json({code: 0, data:data});
      }
    });
  });

  args.app.post('/p/:pad/:rev?/votes/:voteId?', function(req, res) {
    
    new formidable.IncomingForm().parse(req, function (err, fields, files) {
      // check the api key
      if(!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if(!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

      // sanitize pad id before continuing
      var padIdReceived = apiUtils.sanitizePadId(req);

      if (!req.params.voteId && fields.data.status === 'close') {
        voteManager.closePadVotes(padIdReceived, function (err, res) {
          if (err) res.json({error: err});
          console.log(err, res);
          res.json({done: res});
        });
      }
    });
  });

};


var broadcastVotesAdded = function(padId, voteIds, votes) {
  var socket = clientIO.connect(broadcastUrl);

  var data = {
    padId: padId,
    voteIds: voteIds,
    votes: votes
  };

  socket.emit('apiAddVotes', data);
}

var broadcastUrl = apiUtils.broadcastUrlFor("/vote");
