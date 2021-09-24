'use strict';

const eejs = require('ep_etherpad-lite/node/eejs/');
const formidable = require('formidable');
const voteManager = require('./voteManager');
const apiUtils = require('./apiUtils');

const voteOptions = [['Yes'], ['No']];

exports.padRemove = async (hookName, context) => {
  await voteManager.deleteVotes(context.padID);
};

exports.padCopy = async (hookName, context) => {
  await Promise.all([
    voteManager.copyVotes(context.originalPad.id, context.destinationID),
  ]);
};

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
        socket.on('startVote', async (data, callback) => {
          try {
            const result = await voteManager.startVote(data.padId, data);
            callback(null, result);
          } catch (err) {
            callback(err);
          }
        });

        socket.on('getVoteSettings', async (data, callback) => {
          const padId = data.padId;
          const voteId = data.voteId;
          try {
            const result = await voteManager.getVote(padId, voteId);
            callback(null, result);
          } catch (err) {
            return callback(err);
          }
        });

        socket.on('getVoteResult', async (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          try {
            const result = await voteManager.getVoteResult(padId, data.voteId);
            callback(null, result);
          } catch (err) {
            callback(err);
          }
        });

        socket.on('getVoteCount', async (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          try {
            const result = await voteManager.getVoteCount(padId, data.voteId, data.authorID);
            callback(null, result);
          } catch (err) {
            return callback(err);
          }
        });

        socket.on('getVotes', async (data, callback) => {
          const padId = data.padId;
          socket.join(padId);
          try {
            const votes = await voteManager.getVotes(padId);
            callback(null, votes);
          } catch (err) {
            callback(err);
          }
        });

        // On add events
        socket.on('addVote', async (data, callback) => {
          const padId = data.padId;
          try {
            console.log('addVote data: ', data);
            const votes = await voteManager.addVote(padId, data);
            callback(null, votes);
          } catch (err) {
            callback(err);
          }
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

        socket.on('updateVoteSettings', async (data, callback) => {
          const padId = data.padId;
          const voteId = data.voteId;
          const settings = data.settings;
          try {
            const vote = await voteManager.updateVoteSettings(padId, voteId, settings);
            callback(null, vote);
          } catch (err) {
            callback(err);
          }
        });

        socket.on('deleteVote', async (data, callback) => {
          const padId = data.padId;
          const voteId = data.voteId;
          await voteManager.deleteVote(padId, voteId);
          callback(null, true);
        });
      });

  return cb();
};

exports.expressCreateServer = (hookName, args, cb) => {
  args.app.get('/p/:pad/:rev?/votes', async (req, res) => {
    // check the api key
    //  if(!apiUtils.validateApiKey(fields, res)) return;

    // sanitize pad id before continuing
    const padIdReceived = apiUtils.sanitizePadId(req);
    try {
      const data = await voteManager.getVotes(padIdReceived);

      return res.json({code: 0, data});
    } catch (err) {
      return res.json({code: 2, message: 'internal error', data: null});
    }
  });

  args.app.post('/p/:pad/:rev?/votes/:voteId?', (req, res) => {
    new formidable.IncomingForm().parse(req, async (err, fields, files) => {
      // check the api key
      if (!apiUtils.validateApiKey(fields, res)) return;

      // check required fields from comment data
      if (!apiUtils.validateRequiredFields(fields, ['data'], res)) return;

      // sanitize pad id before continuing
      const padIdReceived = apiUtils.sanitizePadId(req);
      if (!req.params.voteId && fields.data.status === 'close') {
        try {
          const res = await voteManager.closePadVotes(padIdReceived);
          res.json({done: res});
        } catch (err) {
          res.json({error: err});
        }
      }
    });
  });

  return cb();
};
