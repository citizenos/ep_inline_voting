'use strict';

const voteManager = require('./voteManager');
const ERR = require('ep_etherpad-lite/node_modules/async-stacktrace');

exports.getPadVotes = (padID, callback) => {
  voteManager.getVotes(padID, (err, padVotes) => {
    if (ERR(err, callback)) return;

    if (padVotes != null) callback(null, padVotes);
  });
};

exports.bulkAddPadVotes = (padID, data, callback) => {
  voteManager.bulkAddVotes(padID, data, (err, voteIDs, votes) => {
    if (ERR(err, callback)) return;

    if (voteIDs != null) callback(null, voteIDs, votes);
  });
};
