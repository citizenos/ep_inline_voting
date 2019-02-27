
var voteManager = require('./voteManager');
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");

function padExists(padID){
  padManager.doesPadExists(padID, function(err, exists){
    return exists;
  });
}

exports.getPadVotes = function(padID, callback)
{
    voteManager.getVotes(padID, function (err, padVotes)
  {
    if(ERR(err, callback)) return;

    if(padVotes !== null) callback(null, padVotes);
  });
};

exports.bulkAddPadVotes = function(padID, data, callback)
{
  voteManager.bulkAddVotes(padID, data, function (err, voteIDs, votes)
  {
    if(ERR(err, callback)) return;

    if(voteIDs !== null) callback(null, voteIDs, votes);
  });
};
