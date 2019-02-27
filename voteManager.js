var _ = require('ep_etherpad-lite/static/js/underscore');
var db = require('ep_etherpad-lite/node/db/DB').db;
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var randomString = require('ep_etherpad-lite/static/js/pad_utils').randomString;
var readOnlyManager = require("ep_etherpad-lite/node/db/ReadOnlyManager.js");
var shared = require('./static/js/shared');

exports.getVotes = function (padId, callback)
{
  // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  // Not sure if we will encouter race conditions here..  Be careful.

  //get the globalComments
  db.get("votes:" + padId, function(err, votes)
  {
    if(ERR(err, callback)) return;
    //comment does not exists
    if(votes == null) votes = {};
    callback(null, { votes: votes });
  });
};

exports.deleteVotes = function (padId, callback)
{
  db.remove('votes:' + padId, function(err)
  {
    if(ERR(err, callback)) return;
    callback(null);
  });
};

exports.addVote = function(padId, data, callback)
{
  exports.bulkAddVotes(padId, [data], function(err, voteIds, votes) {
    if(ERR(err, callback)) return;

    if(voteIds && voteIds.length > 0 && votes && votes.length > 0) {
      callback(null, voteIds[0], votes[0]);
    }
  });
};

exports.bulkAddVotes = function(padId, data, callback)
{
 // We need to change readOnly PadIds to Normal PadIds
  var isReadOnly = padId.indexOf("r.") === 0;
  if(isReadOnly){
    readOnlyManager.getPadId(padId, function(err, rwPadId){
      padId = rwPadId;
    });
  };

  //get the entry
  db.get("votes:" + padId, function(err, votes) {
    if(ERR(err, callback)) return;

    // the entry doesn't exist so far, let's create it
    if(votes == null) votes = {};

    var newVotes = [];
    var voteIds = _.map(data, function(voteData) {
      //if the comment was copied it already has a commentID, so we don't need create one
      console.log(voteData);
      var voteId = voteData.voteId;
      var authorId = voteData.author;

      var vote = {
        "author": voteData.author || "empty",
        "name": voteData.name,
        "voteId": voteData.voteId,
        "value": voteData.value,
        "timestamp": parseInt(voteData.timestamp) || new Date().getTime()
      };
      //add the entry for this pad
      if (!votes[voteId]) {
        votes[voteId] = {};
      }
      votes[voteId][authorId] = vote;
      newVotes.push(vote);
      return voteId;
    });

    //save the new element back
    db.set("votes:" + padId, votes);

    callback(null, voteIds, newVotes);
  });
};
