var _ = require('ep_etherpad-lite/static/js/underscore');
var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var readOnlyManager = require("ep_etherpad-lite/node/db/ReadOnlyManager.js");
var shared = require('./static/js/shared');
//Get Vote settings
var getVote = function (padId, voteId, callback) {
  db.get("votes:" + padId + ":" + voteId, function (err, vote) {
    callback(err, vote);
  });
};

var getVoteResult = function (padId, voteId, callback) {
  db.get("votes:" + padId + ":" + voteId + "result", function (err, result) {
    if(ERR(err, callback)) callback(err);
    
    callback(null, result);
  });
};

// Start new vote, store it's settings and options
exports.startVote = function(padId, data, callback)
{
  var voteId = data.voteId;
  
  db.get("votes:" + padId, function(err, votes)
  {
    if(ERR(err, callback)) return;
    //comment does not exists
    if(votes == null) votes = [];
    votes.push(data.voteId);
    db.set("votes:" + padId, votes); //Store all pad voteIds in one array
  });

  db.set("votes:" + padId + ":" + voteId, data);
  data.dbKey = "votes:" + padId + ":" + voteId;
  callback(null, data);
};

var updateVoteSettings = function (padId, voteId, settings, callback) {
  db.get("votes:" + padId + ":" + voteId, function (err, vote) {
    if (err) return callback(err);
    if (!vote) return callback("No vote found at: 'votes:" + padId + ":" + voteId);
    var allowedFields = ['replace', 'closed'];
    allowedFields.forEach(function (field) {
      if (field === 'replace')  {
        vote.settings.replace = settings.replace;
      } else {
        vote[field] = settings[field];
      }
    });
    
    db.set("votes:" + padId + ":" + voteId, vote);

    callback(null, vote);
  });
};

//Return vote settings data
exports.getVote = function (padId, voteId, callback) 
{
  getVote(padId, voteId, callback);
}
//Return all topic votes data
var getVotes = function (padId, callback)
{
  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  //get list of  all topic votes 
  db.get("votes:" + padId, function(err, votes)
  {
    if(ERR(err, callback)) return console.error('Error', err);
  
    var voteData = {};
    votesLoaded = 0;
    if(votes == null) votes = [];
    votes.forEach(function (voteId) {
      //get settings for every vote

      getVote(padId, voteId, function (err, vote) {
        if(err) throw err;
        
        voteData[voteId] = vote;
        votesLoaded++;

        if (votes.length === votesLoaded) {
          callback(null, { votes: voteData });
        }
      });
    });
  });
};
//Delete vote
exports.deleteVote = function (padId, voteId, callback)
{
  db.remove('votes:' + padId + ':' +voteId, function(err)
  {
    if(ERR(err, callback)) return console.error('Error', err);
    callback(null);
  });
};
//Cast user vote
exports.addVote = function(padId, data, callback)
{
  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };
  var voteId = data.voteId;
  //get the entry
  getVote(padId, voteId, function (err, vote) {
    if (ERR(err, callback)) return console.error('Error', err);

    if (!vote) return;
    
    getVoteResult(padId, voteId, function (err, result) {
      if (ERR(err, callback)) return;

      if (!result) {
        result = {};
        vote.options.forEach(function (option) {
          result[option] = [];
        });
      }

      var voteId = data.voteId;
      var authorId = data.author;
      var option = data.value;

      _.each(Object.keys(result), function (opt) {
        _.each(result[opt], function (voteData, i) {
          if (voteData.author === data.author) {
            result[opt].splice(i, 1);
          }
        });
      });

      result[data.value].push({author: data.author, timestamp: parseInt(data.timestamp) || new Date().getTime()});

      db.set("votes:" + padId + ":" + voteId + "result", result);
      callback(null, result);
    });
  });
};

exports.closePadVotes = function (padId, callback) {
  var errors = [];
  var success = [];
  getVotes(padId, function (err, result) {
    if (err) return callback(err);
    _.each(result.votes, function (vote) {
      if (!vote.closed) {
        updateVoteSettings(padId, vote.voteId, {closed: true}, function (err, data) {
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
  callback(err, success);
};

exports.getVotes = getVotes;
exports.getVoteResult = getVoteResult;
exports.updateVoteSettings = updateVoteSettings;

