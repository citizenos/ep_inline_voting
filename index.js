'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');
const formidable = require('formidable');
const voteManager = require('./voteManager');
const votes = require('./votes');
const apiUtils = require('./apiUtils');

const voteOptions = [['Yes'], ['No']];

exports.padInitToolbar = (hookName, args) => {
  const toolbar = args.toolbar;

  const button = toolbar.button({
    command: 'createVote',
    localizationId: 'ep_inline_vote.create_vote',
    class: 'buttonicon commenticon',
  });

  toolbar.registerButton('createVote', button);
};

exports.eejsBlock_body = (hookName, args, cb) => {
  args.content += eejs.require('ep_inline_voting/templates/vote.ejs', {
    options: voteOptions,
  });

  return cb();
};

exports.eejsBlock_styles = (hookName, args, cb) => {
  args.content += eejs.require('ep_inline_voting/templates/styles.html', {}, module);

  return cb();
};

exports.socketio = (hookName, context, cb) => {
  context.io
      .of('/vote')
      .on('connection', (socket) => {
        socket.on('startVote', (data, callback) => {
          voteManager.startVote(data.padId, data, (err, result) => {
            if (err) console.error('Error', err);
            callback(null, result);
          });
        });

        socket.on('getVoteSettings', (data, callback) => {
          const padId = data.padId;
          const voteId = data.voteId;
          voteManager.getVote(padId, voteId, (err, data) => {
            if (err) console.error('Error', err);
            callback(null, data);
          });
        });

        socket.on('getVoteResult', (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          voteManager.getVoteResult(padId, data.voteId, (err, result) => {
            if (err) console.error(err);
            callback(err, result);
          });
        });

        socket.on('getVoteCount', (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          voteManager.getVoteCount(padId, data.voteId, data.authorID, (err, result) => {
            if (err) console.error(err);
            callback(err, result);
          });
        });

        socket.on('getVotes', (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          voteManager.getVotes(padId, (err, votes) => {
            callback(votes);
          });
        });

        // On add events
        socket.on('addVote', (data, callback) => {
          const padId = data.padId;
          const content = data;
          voteManager.addVote(padId, content, (err, votes) => {
            socket.broadcast.to(padId).emit('pushAddVote', votes);
            callback(err, votes);
          });
        });

        // vote added via API
        socket.on('apiAddVotes', (data) => {
          const padId = data.padId;
          const voteIds = data.voteIds;
          const votes = data.votes;

          for (let i = 0, len = voteIds.length; i < len; i++) {
            socket.broadcast.to(padId).emit('pushAddVote', voteIds[i], votes[i]);
          }
        });

        socket.on('updateVoteSettings', (data, callback) => {
          const padId = data.padId;
          const voteId = data.voteId;
          const settings = data.settings;
          voteManager.updateVoteSettings(padId, voteId, settings, (err, vote) => {
            if (err) console.error('Error', err);
            callback(err, vote);
          });
        });
      });

  return cb();
};

exports.expressCreateServer = (hookName, args, cb) => {
  args.app.get('/p/:pad/:rev?/votes', (req, res) => {
    // check the api key
    //  if(!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    const padIdReceived = apiUtils.sanitizePadId(req);

    votes.getPadVotes(padIdReceived, (err, data) => {
      if (err) {
        res.json({code: 2, message: 'internal error', data: null});
      } else {
        res.json({code: 0, data});
      }
    });
  });

  args.app.post('/p/:pad/:rev?/votes/:voteId?', (req, res) => {
    new formidable.IncomingForm().parse(req, (err, fields, files) => {
      // check the api key
      if (!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

      // sanitize pad id before continuing
      const padIdReceived = apiUtils.sanitizePadId(req);

      if (!req.params.voteId && fields.data.status === 'close') {
        voteManager.closePadVotes(padIdReceived, (err, res) => {
          if (err) res.json({error: err});
          console.log(err, res);
          res.json({done: res});
        });
      }
    });
  });

  return cb();
};
