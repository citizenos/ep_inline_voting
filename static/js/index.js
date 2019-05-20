var _ = require('ep_etherpad-lite/static/js/underscore');

var loc = document.location;
var port = loc.port == "" ? (loc.protocol == "https:" ? 443 : 80) : loc.port;
var url = loc.protocol + "//" + loc.hostname + ":" + port + "/" + "vote";
var socket     = io.connect(url);
var cssFiles = ['ep_inline_voting/static/css/vote.css'];

var buildUserVote = function(voteId, option) {
    var vote = {};
  
    vote.voteId = voteId;
    vote.value = option;
    vote.padId = clientVars.padId;
    vote.author = clientVars.userId;
    vote.createdAt = new Date().getTime();
  
    return vote;
  }

var vote = function (voteId, option) {
    var vote = buildUserVote(voteId, option);
    socket.emit('addVote', vote, function (err, vote){
        $('#inline-vote-form').hide();
        getVoteResult(voteId);
    });
    return false;
}

exports.aceEditorCSS = function(){
    return cssFiles;
}
exports.postToolbarInit = function (hookName, args) {
    var editbar = args.toolbar;
 
    editbar.registerCommand('createVote', function () {
      createVote();
      addVoteClickListeners();
    });
};
var getVoteResult = function (voteId) {
    socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, function (err, result) {
        if (err) console.error(err)
        var resHtml = '';
        $.each(result, function (key, item) {
            resHtml +='<li><span>' + key + '</span> <span> ' + item.length + ' </span></li>';
        });
        
        $('#vote-result-options-list').html(resHtml);
        $('#inline-vote-results').show();
    });
};

var addVoteClickListeners = function () {
    var padInner = $('iframe[name=ace_outer]').contents().find('iframe[name=ace_inner]').contents().find('body');
    $(padInner[0]).find('.vote').each(function (key, elem) {
        $(elem).off();
        $(elem).on('click', function (e) {
            var voteId = e.target.classList.value.match(/(vote-[0-9]+)=?/g)[0];
            var closed = /voteClosed=?/g.test(e.target.classList.value);
            console.log('CLOSED', closed);
            $('#close-vote').off();
            $('#close-vote').on('click', function () {
                handleVoteClose(voteId);
            });
            if (voteId) {
                socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, function (err, voteSettings){
                    if (err) return console.error(err);
                    
                    socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, function (err, voteResult) {
                        console.log(voteSettings, voteResult);
                        closed = voteSettings.closed;
                        var totalVotes = 0;
                        if (voteResult) {
                            $.each(voteResult, function(k, i) {
                                if (i) {
                                    totalVotes += i.length
                                }
                            });
                        }
                        
                        var authors = clientVars.collab_client_vars.historicalAuthorData;
                        console.log(voteResult);
                        for (var authorId in authors) {
                            if (authors.hasOwnProperty(authorId) && authors[voteSettings.author]) {
                                var author = authors[voteSettings.author];
                                $('#creator-name').html(author.name);
                                break;
                            }
                        }
                        var createTime = new Date(voteSettings.createdAt);
                        var datetext = createTime.getDate()+'/'+createTime.getMonth()+'/'+createTime.getFullYear()+' '+createTime.getHours()+':'+createTime.getMinutes();
                        console.log(datetext);
                        $('#create-time').html(datetext);
                        $('#description-content').html(voteSettings.description);
                        var itemHtml = '';
                        _.each(voteSettings.options, function (option) {
                            var vcount = 0;
                            var userVote = false;
                            if (voteResult && voteResult[option]) {
                                vcount = voteResult[option].length;
                                voteResult[option].filter(function (voter) {
                                    if (voter.author == clientVars.userId) {
                                        userVote = true;
                                    }
                                })
                            }
                            
                        //  itemHtml += '<li class="inline-vote-option"><button class="inline-vote-option-button" name="option" value="'+option+'">'+option+'</button></li>'
                            itemHtml += '<div class="option-wrap"> \
                                <div class="option-result-bar-wrap"> \
                                    <label class="container"> \
                                        <input class="vote-option-radio" type="radio" name="option" value="'+option+'" '+ ((userVote)? 'checked' :'') +' /> \
                                        <span class="checkmark"></span> \
                                        <div class="option-result-bar"> \
                                            <div class="option-result-fill" style="width:' + ((vcount/totalVotes * 100) || 1) + ((vcount/totalVotes)? '%': 'px') + ';"> \
                                                <div class="option-result-votes">' + (vcount || 0 )+  '</div> \
                                            </div> \
                                        </div> \
                                    </label> \
                                <div class="option-value">'+option+'</div> \
                                </div> \
                            </div>'
                        });
                        $('#vote-options-list').html(itemHtml);
                        $('.option-wrap').off();
                        if (!closed) {
                            $('#vote-settings-buttons-wrap').show();
                            $('.option-wrap').on('click', function (e) {
                                vote(voteId, $(this).find('input')[0].value);
                            });
                        }
                        
                        $('#inline-vote-form').show();
                        if (closed){
                            $('#inline-vote-form').find('#vote-settings-buttons-wrap').hide();
                        }
                    });
                });
            }
            
        });
    });
};

var closeVote  = function (padId, voteId) {
    var padInner = $('iframe[name=ace_outer]').contents().find('iframe[name=ace_inner]').contents().find('body');
    var self = this;
    var editorInfo = self.editorInfo;

    socket.emit('updateVoteSettings', {padId, voteId, settings: {closed: true}}, function () {
        console.log('VOte closed');
        var rep = editorInfo.ace_getRepFromSelector('.'+voteId, padInner);
        console.log(rep);
        self.editorInfo.ace_callWithAce(function (ace){
            ace.ace_performSelectionChange(rep[0][0], rep[0][1], true);
            ace.ace_setAttributeOnSelection('voteClosed', true);
            $('#inline-vote-settings').hide();
        },'closeVote', true);
    });
};

var handleVoteClose = function (voteId) {
    console.log('HANDLE VOTE CLOSE')
    var editorInfo = this.editorInfo;
    socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, function (err, voteData) {
        if (err) return console.error(err);
        socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, function (err, result) {
            if (err) console.error(err)

            var winner = null;
            var votecount = 0;
            $.each(result, function (key, item) {
                if (!winner || item.length > votecount) {
                    winner = key;
                    votecount = item.length;
                } else if (winner && votecount > 0 && item.length === votecount) {
                    throw new Error('Vote cannot be closed, tie');
                    return;
                }
            });

            if (!winner) {
                return;
            }

            $("#root_lightbox").show();
            $("#vote_button_keep").on('click', function () {
                closeVote(clientVars.padId, voteId);
                $("#root_lightbox").hide();
                $("#inline-vote-form").hide();
            });

            $("#vote_button_replace").on('click', function () {                
                var padOuter = $('iframe[name="ace_outer"]').contents();
                var padInner = padOuter.find('iframe[name="ace_inner"]');

                var padVoteContent = padInner.contents().find("."+voteData.voteId).first();
                winner = winner.replace(/(?:\r\n|\r)/g, '<br />');

                $(padVoteContent).html(winner);
                $("#root_lightbox").hide();
                $("#inline-vote-form").hide();
                closeVote(clientVars.padId, voteId);
            });
        });
    });
};

var getLastLine = function(firstLine, rep){
    var lastLineSelected = rep.selEnd[0];
  
    if (lastLineSelected > firstLine){
      // Ignore last line if the selected text of it it is empty
      if(lastLineSelectedIsEmpty(rep, lastLineSelected)){
        lastLineSelected--;
      }
    }
    return lastLineSelected;
};

var lastLineSelectedIsEmpty = function(rep, lastLineSelected){
    var line = rep.lines.atIndex(lastLineSelected);
    // when we've a line with line attribute, the first char line position
    // in a line is 1 because of the *, otherwise is 0
    var firstCharLinePosition = (line.lineMarker === 1) ? 1 : 0;
    var lastColumnSelected = rep.selEnd[1];

    return lastColumnSelected === firstCharLinePosition;
}
var getSelectedText = function(rep) {
    var self = this;
    var firstLine = rep.selStart[0];
    var lastLine = getLastLine(firstLine, rep);
    var selectedText = "";
  
    _(_.range(firstLine, lastLine + 1)).each(function(lineNumber){
       var line = rep.lines.atIndex(lineNumber);
       // If we span over multiple lines
       if(rep.selStart[0] === lineNumber){
         // Is this the first line?
         if(rep.selStart[1] > 0){
           var posStart = rep.selStart[1];
         }else{
           var posStart = 0;
         }
       }
       if(rep.selEnd[0] === lineNumber){
         if(rep.selEnd[1] <= line.text.length){
           var posEnd = rep.selEnd[1];
         }else{
           var posEnd = 0;
         }
       }
       var lineText = line.text.substring(posStart, posEnd);
       // When it has a selection with more than one line we select at least the beginning
       // of the next line after the first line. As it is not possible to select the beginning
       // of the first line, we skip it.
       if(lineNumber > firstLine){
        // if the selection takes the very beginning of line, and the element has a lineMarker,
        // it means we select the * as well, so we need to clean it from the text selected
        lineText = self.cleanLine(line, lineText);
        lineText = '\n' + lineText;
       }
       selectedText += lineText;
    });
    return selectedText;
};

var createVote = function() {
    var self = this;
    var rep = self.rep;
    var now = new Date().getTime();
    var defaultOptionText = getSelectedText(rep);
    
    $('#inline-vote-settings').show();
    $('#vote-option-1').val(defaultOptionText);
    var description = $('#vote-description').val();
    $('#start-vote').on('click', function () {
        var options = [];
        $('.vote-option-input').each(function (key, item) {
            if (item.value) {
                options.push(item.value);
            }
        });
        var voteId = 'vote-' + now; //Get more uniqueID
        var voteData = {
            voteId,
            createdAt: now,
            description,
            options,
            selectedText: defaultOptionText,
            padId: clientVars.padId,
            author: clientVars.userId,
            closed: false
        };

        if (options.length) {
            socket.emit('startVote', voteData, function (err, data){
                self.editorInfo.ace_callWithAce(function (ace){
                    ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
                    ace.ace_setAttributeOnSelection(voteId, true);
                    ace.ace_setAttributeOnSelection('vote', true);
                    $('#inline-vote-settings').hide();
                    addVoteClickListeners();
                },'createNewVote', true);
            });
        }       
        $('#inline-vote-settings').hide();
        addVoteClickListeners();
    });
}

var getVotes = function (callback){
    var req = { padId: clientVars.padId };

    socket.emit('getVotes', req, function (res){
        callback(res.votes);
    });
};


exports.aceInitialized = function(hook, context){
    createVote = _(createVote).bind(context);
    closeVote = _(closeVote).bind(context);
    handleVoteClose = _(handleVoteClose).bind(context);
    
    $('#inline-vote-form').off('submit');

    $('#cancel-vote').on('click', function () {
        $('#inline-vote-settings').hide();
    });

    $('.close-inline-vote-modal').on('click', function (e) {
        console.log(this);
        $(e.target).parent().hide();
    });
    
    $('#inline-vote-add-option').on('click', function () {
        if ($('#vote-options-wrap .vote-option-input').length < 5) {
            var itemIndex =$('#vote-options-wrap .vote-option-input').length + 1;
            var optionInput = '<div class="option-wrap"><input class="vote-option-input" type="text" id="vote-option-' + itemIndex + '" name="vote-option-' + itemIndex + '"/><div class="remove-vote-option"></div></div>';
            $('#vote-options-wrap').find(".option-wrap:last-child").before(optionInput);
            $('.remove-vote-option').off();
            $('.remove-vote-option').on('click', function () {
                if ($('.remove-vote-option').length > 2) {
                    $(this).parent().remove();
                } else  {
                    $(this).parent().find('input').val('');
                }
                
            });
        }
    });
    $('.remove-vote-option').on('click', function () {
        if ($('.remove-vote-option').length > 2) {
            $(this).parent().remove();
        } else  {
            $(this).parent().find('input').val('');
        }
        
    });
}

exports.aceAttribsToClasses = function(hook, context){
    if (context.key.indexOf('vote') === 0) {
        return [context.key];
    }

}
  
exports.aceAttribClasses = function(hook, attr){
    return attr;
}

exports.postAceInit = function(hook, attr) {
    addVoteClickListeners();
}
