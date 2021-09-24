'use strict';

const _ = require('ep_etherpad-lite/static/js/underscore');
const db = require('ep_etherpad-lite/node/db/DB');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager.js');

// Get Vote settings
const getVote = async (padId, voteId) => {
  let vote = await db.get(`votes:${padId}:${voteId}`);
  if (vote == null) vote = {};
  return vote;
};

const getVoteResult = async (padId, voteId) => {
  let result = await db.get(`votes:${padId}:${voteId}result`);
  if (result == null) result = {};

  return result;
};

const getVoteCount = async (padId, voteId, authorID) => {
  const returndata = {count: 0};

  const voteResult = await getVoteResult(padId, voteId);

  if (!voteResult) return voteResult;
  Object.keys(voteResult).forEach((opt) => {
    Object.entries(voteResult[opt]).forEach(([key, vote]) => {
      if (vote.author === authorID) {
        returndata.userOption = opt;
      }
    });
    returndata.count += voteResult[opt].length;
  });

  return returndata;
};

// Start new vote, store it's settings and options
exports.startVote = async (padId, data) => {
  const voteId = data.voteId;

  let votes = await db.get(`votes:${padId}`);
  // comment does not exists
  if (votes == null) votes = [];
  votes.push(data.voteId);
  await db.set(`votes:${padId}`, votes); // Store all pad voteIds in one array

  await db.set(`votes:${padId}:${voteId}`, data);
  data.dbKey = `votes:${padId}:${voteId}`;

  return data;
};

const updateVoteSettings = async (padId, voteId, settings) => {
  const vote = await db.get(`votes:${padId}:${voteId}`);
  if (!vote) return `No vote found at: 'votes:${padId}:${voteId}`;

  const allowedFields = ['replace', 'closed'];
  allowedFields.forEach((field) => {
    vote[field] = settings[field];
  });

  await db.set(`votes:${padId}:${voteId}`, vote);

  return vote;
};

// Return all topic votes data
const getVotes = async (padId) => {
  // We need to change readOnly PadIds to Normal PadIds
  const isReadOnly = padId.indexOf('r.') === 0;
  if (isReadOnly) {
    readOnlyManager.getPadId(padId, (err, rwPadId) => {
      padId = rwPadId;
    });
  }

  // get list of  all topic votes
  let votes = await db.get(`votes:${padId}`);

  const voteData = {};
  if (votes == null) votes = [];
  votes.forEach(async (voteId) => {
    // get settings for every vote
    const vote = await getVote(padId, voteId);
    voteData[voteId] = vote;
  });

  return {votes: voteData};
};

exports.copyVotes = async (sourceID, destinationID) => {
  const originalVotes = await db.get(`votes:${sourceID}`);
  const idCopies = _.clone(originalVotes);
  if (!originalVotes) return;
  originalVotes.forEach(async (voteId) => {
    // make sure we have different copies of the vote between pads
    const vote = await getVote(sourceID, voteId);
    const voteResult = await getVoteResult(sourceID, voteId);
    const copiedVote = _.clone(vote);
    const copiedResult = _.clone(voteResult);
    copiedVote.createdAt = new Date().getTime();
    // save the vote on new pad
    await db.set(`votes:${destinationID}:${voteId}`, copiedVote);
    await db.set(`votes:${destinationID}:${voteId}result`, copiedResult);
  });
  await db.set(`votes:${destinationID}`, idCopies);
};

const _deleteVoteResults = async (padId, voteId) => {
  await db.remove(`votes:${padId}:${voteId}result`);
};

const _deleteVote = async (padId, voteId) => {
  await db.remove(`votes:${padId}:${voteId}`);
  await _deleteVoteResults(padId, voteId);
};

// Delete vote
exports.deleteVote = _deleteVote;
exports.deleteVoteResults = _deleteVoteResults;

// Cast user vote
exports.addVote = async (padId, data) => {
  // We need to change readOnly PadIds to Normal PadIds
  const isReadOnly = padId.indexOf('r.') === 0;
  if (isReadOnly) {
    readOnlyManager.getPadId(padId, (err, rwPadId) => {
      padId = rwPadId;
    });
  }
  const voteId = data.voteId;
  const authorId = data.author;
  const option = data.value;
  // get the entry
  const vote = await getVote(padId, voteId);

  if (!vote) return;

  if (vote.closed) {
    return 'Voting is closed!';
  }

  let result = await getVoteResult(padId, voteId);
  if (!result || Object.keys(result).length === 0) {
    result = {};
    vote.options.forEach((option) => {
      result[option] = [];
    });
  }

  Object.keys(result).forEach((opt) => {
    for (const [i, voteData] of Object.entries(result[opt])) {
      if (voteData.author === authorId) {
        result[opt].splice(i, 1);
      }
    }
  });

  if (result[option]) {
    result[option].push({
      author: data.author,
      timestamp: parseInt(data.timestamp) || new Date().getTime(),
    });

    await db.set(`votes:${padId}:${voteId}result`, result);
    return result;
  } else {
    return `Invalid option:${option}`;
  }
};

exports.closePadVotes = async (padId) => {
  const success = [];
  const result = await getVotes(padId);
  Object.entries(result.votes).forEach(async ([key, vote]) => {
    if (vote && !vote.closed) {
      const data = await updateVoteSettings(padId, vote.voteId, {closed: true});
      success.push(data);
    }
  });

  return success;
};

exports.getVote = getVote;
exports.getVotes = getVotes;
exports.getVoteResult = getVoteResult;
exports.getVoteCount = getVoteCount;
exports.updateVoteSettings = updateVoteSettings;
