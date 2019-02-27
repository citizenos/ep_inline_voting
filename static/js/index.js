var _ = require('ep_etherpad-lite/static/js/underscore');

var loc = document.location;
var port = loc.port == "" ? (loc.protocol == "https:" ? 443 : 80) : loc.port;
var url = loc.protocol + "//" + loc.hostname + ":" + port + "/" + "vote";
var socket     = io.connect(url);

var buildVote = function(form) {
    var voteId = $('#voteId').val();
    var vote = {};
  
    vote.voteId = voteId;
    vote.value = form.val();
    vote.padId = clientVars.padId;
    vote.author = clientVars.userId;
  
    return vote;
  }

var vote = function (v) {
    console.log('Vote', v);
}
// Callback for new comment Submit
var castNewVote = function(option, callback) {
    console.log(option);
    var vote = buildVote(option);
    socket.emit('addVote', vote, function (voteId, vote){
        vote.voteId = voteId;

        console.log('DATA', vote, voteId);
        getVotes(function (data) {
            console.log('NEW VOTE', data)
        });
    });
    return false;
}

exports.postToolbarInit = function (hookName, args) {
    var editbar = args.toolbar;
 
    editbar.registerCommand('createVote', function () {
      createVote();
      addVoteClickListeners();
    });
};
var addVoteClickListeners = function () {
    var padInner = $('iframe[name=ace_outer]').contents().find('iframe[name=ace_inner]').contents().find('body');
    $(padInner[0]).find('.vote').each(function (key, elem) {
        $(elem).off();
        $(elem).on('click', function (e) {
            var voteId = e.target.classList.value.match(/(vote-[0-9]+)=?/g)[0];
            $('#inline-vote-form').toggle();
            $('#inline-vote-form').find('#voteId').val(voteId);
        });
    });
}
var createVote = function() {
    var self = this;
    var rep = self.rep;
    var now = new Date().getTime();
    self.editorInfo.ace_callWithAce(function (ace){
        var voteId = 'vote-' + now;
        ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
        ace.ace_setAttributeOnSelection(voteId, true);
        ace.ace_setAttributeOnSelection('vote', true);
    },'createNewVote', true);
}

var getVotes = function (callback){
    console.log('getVOtes')
    var req = { padId: clientVars.padId };

    socket.emit('getVotes', req, function (res){
        console.log('RES', res);
        callback(res.votes);
    });
};


exports.aceInitialized = function(hook, context){
    createVote = _(createVote).bind(context);
    $('#inline-vote-form').off('submit');
    $('.inline-vote-option-button').on('click', function(e) {
        var form = $(this);
        return castNewVote(form, function (res) {
            console.log('RES new', res);
        });
    });
    getVotes(function (data) {
        console.log('VOtes', data);
    });
}

exports.aceAttribsToClasses = function(hook, context){
    if (context.key.indexOf('vote') === 0) {
        return [context.key];
    }

}
  
exports.aceAttribClasses = function(hook, attr){
    console.log('aceAttribClasses', attr);
    return attr;
}

exports.postAceInit = function(hook, attr) {
    console.log('POST ACE INIT');
    addVoteClickListeners();

}
