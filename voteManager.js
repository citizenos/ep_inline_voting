'use strict';

const _ = require('ep_etherpad-lite/static/js/underscore');
const db = require('ep_etherpad-lite/node/db/DB').db;
const ERR = require('ep_etherpad-lite/node_modules/async-stacktrace');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager.js');

// Get Vote settings
const getVote = (padId, voteId, callback) => {
  db.get(`votes:${padId}:${voteId}`, (err, vote) => {
    callback(err, vote);
  });
};

const getVoteResult = (padId, voteId, callback) => {
  db.get(`votes:${padId}:${voteId}result`, (err, result) => {
    if (ERR(err, callback)) callback(err);

    callback(null, result);
  });
};

const getVoteCount = (padId, voteId, authorID, callback) => {
  const returndata = {count: 0};
  getVoteResult(padId, voteId, (err, result) => {
    if (err) return callback(err);
    if (!result) return callback(null, returndata);
    _.each(Object.keys(result), (opt) => {
      _.each(result[opt], (vote) => {
        if (vote.author === authorID) {
          returndata.userOption = opt;
        }
      });
      returndata.count += result[opt].length;
    });

    return callback(null, returndata);
  });
};

// Start new vote, store it's settings and options
exports.startVote = (padId, data, callback) => {
  const voteId = data.voteId;

  db.get(`votes:${padId}`, (err, votes) => {
    if (ERR(err, callback)) return;
    // comment does not exists
    if (votes == null) votes = [];
    votes.push(data.voteId);
    db.set(`votes:${padId}`, votes); // Store all pad voteIds in one array
  });

  db.set(`votes:${padId}:${voteId}`, data);
  data.dbKey = `votes:${padId}:${voteId}`;
  callback(null, data);
};

const updateVoteSettings = (padId, voteId, settings, callback) => {
  db.get(`votes:${padId}:${voteId}`, (err, vote) => {
    if (err) return callback(err);
    if (!vote) return callback(`No vote found at: 'votes:${padId}:${voteId}`);
    const allowedFields = ['replace', 'closed'];
    allowedFields.forEach((field) => {
      vote[field] = settings[field];
    });

    db.set(`votes:${padId}:${voteId}`, vote);

    callback(null, vote);
  });
};

// Return vote settings data
exports.getVote = (padId, voteId, callback) => {
  getVote(padId, voteId, callback);
};
// Return all topic votes data
const getVotes = (padId, callback) => {
  // We need to change readOnly PadIds to Normal PadIds
  const isReadOnly = padId.indexOf('r.') === 0;
  if (isReadOnly) {
    readOnlyManager.getPadId(padId, (err, rwPadId) => {
      padId = rwPadId;
    });
  }

  // get list of  all topic votes
  db.get(`votes:${padId}`, (err, votes) => {
    if (ERR(err, callback)) return console.error('Error', err);

    const voteData = {};
    let votesLoaded = 0;
    if (votes == null) votes = [];
    votes.forEach((voteId) => {
      // get settings for every vote

      getVote(padId, voteId, (err, vote) => {
        if (err) throw err;

        voteData[voteId] = vote;
        votesLoaded++;

        if (votes.length === votesLoaded) {
          callback(null, {votes: voteData});
        }
      });
    });
  });
};
// Delete vote
exports.deleteVote = (padId, voteId, callback) => {
  db.remove(`votes:${padId}:${voteId}`, (err) => {
    if (ERR(err, callback)) return console.error('Error', err);
    callback(null);
  });
};
// Cast user vote
exports.addVote = (padId, data, callback) => {
  // We need to change readOnly PadIds to Normal PadIds
  const isReadOnly = padId.indexOf('r.') === 0;
  if (isReadOnly) {
    readOnlyManager.getPadId(padId, (err, rwPadId) => {
      padId = rwPadId;
    });
  }
  const voteId = data.voteId;
  // get the entry
  getVote(padId, voteId, (err, vote) => {
    if (ERR(err, callback)) return console.error('Error', err);

    if (!vote) return;

    if (vote.closed) {
      return callback('Voting is closed!');
    }

    getVoteResult(padId, voteId, (err, result) => {
      if (ERR(err, callback)) return;

      if (!result) {
        result = {};
        vote.options.forEach((option) => {
          result[option] = [];
        });
      }

      const voteId = data.voteId;
      const authorId = data.author;
      const option = data.value;

      _.each(Object.keys(result), (opt) => {
        _.each(result[opt], (voteData, i) => {
          if (voteData.author === authorId) {
            result[opt].splice(i, 1);
          }
        });
      });

      if (result[option]) {
        result[option].push({
          author: data.author,
          timestamp: parseInt(data.timestamp) || new Date().getTime(),
        });
        db.set(`votes:${padId}:${voteId}result`, result);
        callback(null, result);
      } else {
        callback(`Invalid option:${option}`);
      }
    });
  });
};

exports.closePadVotes = (padId, callback) => {
  const errors = [];
  const success = [];
  getVotes(padId, (err, result) => {
    if (err) return callback(err);
    _.each(result.votes, (vote) => {
      if (!vote.closed) {
        updateVoteSettings(padId, vote.voteId, {closed: true}, (err, data) => {
          if (err) {
            errors.push(err);
          } else {
            success.push(data);
          }
        });
      }
    });
  });
  if (!errors.length) return callback(null, success);

  callback(errors, success);
};

exports.getVotes = getVotes;
exports.getVoteResult = getVoteResult;
exports.getVoteCount = getVoteCount;
exports.updateVoteSettings = updateVoteSettings;
