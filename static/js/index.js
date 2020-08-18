var _ = require('ep_etherpad-lite/static/js/underscore');

var loc = document.location;
var port = loc.port == "" ? (loc.protocol == "https:" ? 443 : 80) : loc.port;
var url = loc.protocol + "//" + loc.hostname + ":" + port + "/" + "vote";
var socket     = io.connect(url, {forceNew: true});
var cssFiles = ['ep_inline_voting/static/css/vote.css'];
var Security = require('ep_etherpad-lite/static/js/security');

var lastLineSelectedIsEmpty = function(rep, lastLineSelected) {
    var line = rep.lines.atIndex(lastLineSelected);
    // when we've a line with line attribute, the first char line position
    // in a line is 1 because of the *, otherwise is 0
    var firstCharLinePosition = (line.lineMarker === 1) ? 1 : 0;
    var lastColumnSelected = rep.selEnd[1];

    return lastColumnSelected === firstCharLinePosition;
}

var getAuthorName = function (authorID) {
    var authors = clientVars.collab_client_vars.historicalAuthorData;
    if (authors[authorID]) {
        return authors[authorID].name;
    }

    return null;
};

var getLastLine = function(rep) {
    var firstLine = rep.selStart[0];
    var lastLineSelected = rep.selEnd[0];

    if (lastLineSelected > firstLine){
      // Ignore last line if the selected text of it it is empty
      if(lastLineSelectedIsEmpty(rep, lastLineSelected)){
        lastLineSelected--;
      }
    }
    return lastLineSelected;
}

function getYOffsetOfRep(rep){
    var padOuter = $('iframe[name="ace_outer"]');
    var padInner = padOuter.contents().find('iframe[name="ace_inner"]');
    var topCorrection = padOuter.offset().top + padInner.offset().top + parseInt(padOuter.css('padding-top')) + parseInt(padOuter.css('margin-top'));

    // Get the target Line
    var index = getLastLine(rep);
    var line = rep.lines.atIndex(index);
    var divEl = $(line.lineNode);

    // Is the line visible yet?
    if ( divEl.length !== 0 ) {
      var top = divEl.offset().top + divEl.height() + topCorrection; // A standard generic offset

      return top;
    }
}

var cloneLine = function (line) {
    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    var lineElem = $(line.lineNode);
    var lineClone = lineElem.clone();
    var innerdocbodyMargin = $(lineElem).parent().css("margin-left") || 0;
    padInner.contents().find('body').append(lineClone);
    lineClone.css({position: 'absolute'});
    lineClone.css(lineElem.offset());
    lineClone.css({color:'red'});
    lineClone.css({left: innerdocbodyMargin});
    lineClone.width(lineElem.width());

    return lineClone;
};
// Given a rep we get the X and Y px offset
function getXYOffsetOfRep(element, rep){
    var viewPosition = 'bottom';
    var clone;
    var selStart = rep.selStart
    var selEnd = rep.selEnd;
    var startIndex = 0;
    var endIndex = 0;

    if (selStart[0] > selEnd [0] || (selStart[0] === selEnd[0] && selStart[1] > selEnd[1])) { //make sure end is after start
      var startPos = _.clone(selStart);
      selEnd = selStart;
      selStart = startPos;
    }

    var padOuter = $('iframe[name="ace_outer"]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');

    // Get the target Line
    var startLine = rep.lines.atIndex(selStart[0]);
    var endLine = rep.lines.atIndex(selEnd[0]);
    var leftOffset = $(padInner)[0].offsetLeft + $('iframe[name="ace_outer"]')[0].offsetLeft + parseInt(padInner.css('padding-left'));
    if($(padInner)[0]){
      leftOffset = leftOffset +3; // it appears on apple devices this might not be set properly?
    }
    // Add support for page view margins
    var divMargin = $(startLine.lineNode).css("margin-left");
    var innerdocbodyMargin = parseInt($(startLine.lineNode).parent().css("margin-left")) || 0;
    var lineText = [];
    var lineIndex = 0;

    if (viewPosition === 'top') {
      startIndex = selStart[1];
      lineIndex = selStart[0];
      lineText = Security.escapeHTML($(startLine.lineNode).text()).split('');
      endIndex = lineText.length-1;
      clone = cloneLine(startLine);
      if (selStart[0] === selEnd[0]) {
        endIndex = selEnd[1];
      }
    } else {
      endIndex = selEnd[1];
      lineIndex = selEnd[0];
      lineText = Security.escapeHTML($(endLine.lineNode).text()).split('');
      clone = cloneLine(endLine);
      if (selStart[0] === selEnd[0]) {
        startIndex = selStart[1];
      }
    }

    lineText.splice(endIndex, 0, '</span>');
    lineText.splice(startIndex, 0, '<span id="selectWorker">');
    lineText = lineText.join('');
    var itemMargin = parseInt(element.children().css('margin-left'));
    var heading = isHeading(lineIndex);
    if (heading) {
      lineText = '<' + heading + '>' + lineText + '</' + heading + '>';
    }
    $(clone).html(lineText);

    // Is the line visible yet?
    if ( $(startLine.lineNode).length !== 0 ) {

      var worker =  $(clone).find('#selectWorker');
      var top = worker.offset().top + padInner.offset().top + parseInt(padInner.css('padding-top')); // A standard generic offset'
      var left = (worker.offset().left || 0) + leftOffset + itemMargin + $(worker).width()/2 - element.width()/2;

      //adjust position
      if (viewPosition === 'top') {
        top = top - element[0].offsetHeight;
        if(top <= 0 ) {  // If the tooltip wont be visible to the user because it's too high up
          top = top + worker[0].offsetHeight;
          if(top < 0){ top = 0; } // handle case where caret is in 0,0
        }
      } else if (viewPosition === 'bottom') {
        top = top + worker[0].offsetHeight;
      } else if (viewPosition === 'right') {
        left = worker.offset().left + worker[0].offsetWidth + leftOffset + itemMargin;
        top = top +(worker[0].offsetHeight/2);
      } else if (viewPosition === 'left') {
        left = 0;
        if (divMargin) {
          divMargin = parseInt(divMargin);
          if ((divMargin + innerdocbodyMargin) > 0) {
            left = left + divMargin;
          }
        }
        left = left - worker.width();
        top  = top +(worker[0].offsetHeight/2);
      }

      // Remove the clone element
      $(clone).remove();
      return [left, top];
    }
}

// Draws the toolbar onto the screen
function drawAt(element, XY){
    element.show();
    element.addClass('popup-show');
    element.css({
      "position": "absolute",
      "left": XY[0],
      "top": XY[1]
    });
}

var buildUserVote = function(voteId, option) {
    var vote = {};

    vote.voteId = voteId;
    vote.value = option;
    vote.padId = clientVars.padId;
    vote.author = clientVars.userId;
    vote.createdAt = new Date().getTime();

    return vote;
  }

var vote = function (voteId) {
    var option = $('.vote-option-radio:checked').val();
    if (voteId && option) {
        var vote = buildUserVote(voteId, option);
        socket.emit('addVote', vote, function (err, vote){
        if (err) return console.error(err);
        });
    }

    $('#inline-vote-form').hide();
    $('#inline-vote-form').removeClass('popup-show');
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

var getDateTimeString = function(timestamp) {
    var d = new Date(timestamp);
    return d.getDate() +'/'+ (d.getMonth()+1) + '/' + d.getFullYear() + ' '  + d.getHours() + ':' + ('0' + d.getMinutes()).substr(-2);
};

var getVoteCount = function (voteId) {
    var padOuter = $('iframe[name="ace_outer"]');
    var padInner = padOuter.contents().find("body").find('iframe[name="ace_inner"]');

    socket.emit('getVoteSettings', {padId: clientVars.padId, voteId, authorID: clientVars.userId}, function (err, voteSettings) {
        socket.emit('getVoteCount', {padId: clientVars.padId, voteId, authorID: clientVars.userId}, function (err, result) {
            var countHTML = html10n.get('ep_inline_voting.total_votes', {'count': result.count});
            $('#vote-count').text(countHTML);
            $('#creator-name').text(getAuthorName(voteSettings.author));
            $('#create-time').text(getDateTimeString(voteSettings.createdAt));
            $('#description-content').text(voteSettings.description);

            var itemHtml = "";
            _.each(voteSettings.options, function (option) {
                var userVote = false;
                if (result.userOption && result.userOption === option) {
                    userVote = true;
                }

                itemHtml += '<div class="option-wrap"> \
                    <div class="option-result-bar-wrap"> \
                        <label class="container"> \
                            <input class="vote-option-radio" type="radio" name="option" value="'+option+'" '+ ((userVote)? 'checked' :'') +' /> \
                            <span class="checkmark"></span> \
                            <div class="option-value-active">'+option+'</div> \
                        </label> \
                    </div> \
                </div>'
            });

            $('#vote-options-list').html(itemHtml);

            var topCorrection = padOuter.offset().top + padInner.offset().top + parseInt(padOuter.css('padding-top')) + parseInt(padOuter.css('margin-top'));
            var h = padInner.contents().find('.'+voteId).height();
            var XY= [padInner.offset().left + padInner.contents().find('.'+voteId).offset().left, padInner.contents().find('.'+voteId).offset().top + h + topCorrection];

            $('#inline-vote-settings').hide();
            $('#inline-vote-settings').removeClass('popup-show');
            drawAt($('#inline-vote-form'), XY);
        });
    });
};

var getVoteResult = function (voteId) {
    var padOuter = $('iframe[name="ace_outer"]');
    var padInner = padOuter.contents().find("body").find('iframe[name="ace_inner"]');

    socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, function (err, voteSettings){
        if (err) {
            return console.error(err);
        }

        $('#creator-name').text(getAuthorName(voteSettings.author));
        $('#create-time').text(getDateTimeString(voteSettings.createdAt));
        $('#description-content').text(voteSettings.description);

        socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, function (err, result) {
            if (err) console.error(err)
            var itemHtml = '';
            var totalVotes = 0;

            $.each(Object.keys(result), function (key, item) {
                totalVotes += result[item].length;
            });

            $.each(Object.keys(result), function (key, item) {
                var vcount = 0;
                var userVote = false;
                if (result && result[item]) {
                    vcount = result[item].length;
                    result[item].filter(function (voter) {
                        if (voter.author == clientVars.userId) {
                            userVote = true;
                        }
                    })
                }
                var barLength = 0;
                var resultText = item;
                var valueText = "";
                if (voteSettings && voteSettings.closed) {
                    barLength = ((vcount/totalVotes * 100) || 1) + ((vcount/totalVotes)? '%': 'px');
                    resultText = (vcount || 0 );
                    valueText = item;
                    $('#vote-form-buttons-wrap').hide();
                }

                itemHtml += '<div class="option-wrap"> \
                    <div class="option-result-bar-wrap"> \
                        <label class="container"> \
                            <input class="vote-option-radio" type="radio" name="option" value="'+item+'" '+ ((userVote)? 'checked' :'') +' /> \
                            <span class="checkmark"></span> \
                            <div class="option-result-bar"> \
                                <div class="option-result-fill" style="width:' + barLength + ';"> \
                                    <div class="option-result-votes">' +resultText+  '</div> \
                                </div> \
                            </div> \
                        </label> \
                        <div class="option-value">'+valueText+'</div> \
                    </div> \
                </div>'
            });

            $('#vote-options-list').html(itemHtml);
            if (voteSettings && voteSettings.closed) {
                $('.vote-option-radio').attr('disabled', true);
            }
            var topCorrection = padOuter.offset().top + padInner.offset().top + parseInt(padOuter.css('padding-top')) + parseInt(padOuter.css('margin-top'));
            var h = padInner.contents().find('.'+voteId).height();
            var XY = [padInner.offset().left + padInner.contents().find('.'+voteId).offset().left, padInner.contents().find('.'+voteId).offset().top + h + topCorrection];
            $('#inline-vote-settings').hide();
            $('#inline-vote-settings').removeClass('popup-show');
            drawAt($('#inline-vote-form'), XY);
        });
    });
};

var addVoteClickListeners = function () {
    var padOuter = $('iframe[name="ace_outer"]');
    var padInner = padOuter.contents().find("body").find('iframe[name="ace_inner"]');

    var voteClickListeners = function (key, elem) {
        $(elem).off();
        $(elem).on('click', function (e) {
            $('#vote-form-buttons-wrap').show();
            $('.vote-option-radio').attr('disabled', false);
            var voteId = e.currentTarget.classList.value.match(/(vote-[0-9]+)=?/g)[0];
            $('#close-vote').off();
            $('#close-vote').on('click', function (e) {
                handleVoteClose(voteId, e);
            });
            $('#save-vote').off();
            $('#save-vote').on('click', function () {
                vote(voteId);
            });
            if (voteId) {
                socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, function (err, voteSettings){
                    if (err) {
                        return console.error(err);
                    }

                    if (voteSettings.closed) {
                        getVoteResult(voteId);

                    } else  {
                        getVoteCount(voteId);
                    }
                });
            }

        });
    };

    $(padOuter).contents().find('.vote-icon').each(voteClickListeners);
    $(padInner).contents().find('.vote').each(voteClickListeners);
};

var closeVote  = function (padId, voteId) {
    var padInner = $('iframe[name=ace_outer]').contents().find('iframe[name=ace_inner]').contents().find('body');
    var self = this;
    var editorInfo = self.editorInfo;

    socket.emit('updateVoteSettings', {padId, voteId, settings: {closed: true}}, function () {
        var rep = editorInfo.ace_getRepFromSelector('.'+voteId, padInner);
        self.editorInfo.ace_callWithAce(function (ace){
            ace.ace_performSelectionChange(rep[0][0], rep[0][1], true);
            ace.ace_setAttributeOnSelection('voteClosed', true);
            $('#inline-vote-settings').hide();
            $('#inline-vote-settings').removeClass('popup-show');
            addVoteClickListeners();
        },'closeVote', true);
    });
};

var handleVoteClose = function (voteId, triger) {
    socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, function (err, voteData) {
        if (err) {
            return console.error(err);
        }

        socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, function (err, result) {
            if (err) console.error(err)

            var winner = null;
            var votecount = 0;
            $.each(result, function (key, item) {
                if (!winner || item.length > votecount) {
                    winner = key;
                    votecount = item.length;
                } else if (winner && votecount > 0 && item.length === votecount) {
                    winner = null;
                    $.gritter.add({
                        title: "Error",
                        text: "Vote cannot be closed, tie",
                        class_name: "error"
                    });
                    return;
                }
            });

            if (winner) {
                var XY = [$(triger.target).closest('.popup').offset().left, $(triger.target).closest('.popup').offset().top];
                drawAt($("#close_confirm"), XY)
                $('#vote_selected_text').html(voteData.selectedText);
                $('#vote_winner_text').html(winner);
                $("#vote_button_keep").on('click', function () {
                    closeVote(clientVars.padId, voteId);
                    $("#close_confirm").hide();
                    $("#close_confirm").removeClass('popup-show');
                    $("#inline-vote-form").hide();
                    $("#inline-vote-form").removeClass('popup-show');
                });

                $("#vote_button_replace").on('click', function () {
                    var padOuter = $('iframe[name="ace_outer"]').contents();
                    var padInner = padOuter.find('iframe[name="ace_inner"]');

                    var padVoteContent = padInner.contents().find("."+voteData.voteId).first();
                    winner = winner.replace(/(?:\r\n|\r)/g, '<br />');

                    $(padVoteContent).html(winner);
                    $("#close_confirm").hide();
                    $("#close_confirm").removeClass('popup-show');
                    $("#inline-vote-form").hide();
                    $("#inline-vote-form").removeClass('popup-show');
                    closeVote(clientVars.padId, voteId);
                });
            }
        });
    });
};

var lastLineSelectedIsEmpty = function(rep, lastLineSelected){
    var line = rep.lines.atIndex(lastLineSelected);
    // when we've a line with line attribute, the first char line position
    // in a line is 1 because of the *, otherwise is 0
    var firstCharLinePosition = (line.lineMarker === 1) ? 1 : 0;
    var lastColumnSelected = rep.selEnd[1];

    return lastColumnSelected === firstCharLinePosition;
};

var getSelectedText = function(rep) {
    var self = this;
    var firstLine = rep.selStart[0];
    var lastLine = getLastLine(rep);
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

    $('#vote-description-area').val("");
    $('#vote-description-area').attr("placeholder", html10n.get('ep_inline_voting.vote_title_label'));
    var XY = getXYOffsetOfRep($('#inline-vote-settings'), rep);
    $('#inline-vote-form').hide();
    $("#inline-vote-form").removeClass('popup-show');
    $('#close_confirm').hide();
    $('#close_confirm').removeClass('popup-show');
    drawAt($('#inline-vote-settings'), XY);

    var itemCount = 0;
    $('.vote-option-input').each(function (key, item) {
        itemCount++;
        item.value = '';
        if (itemCount > 2) {
            item.remove();
        }
    });
    $('#vote-option-1').val(defaultOptionText);
    $('#start-vote').off();
    $('#start-vote').on('click', function () {
        var options = [];
        var description = $('#vote-description-area').val() || "";
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

        if (options.length && options.length > 1) {
            socket.emit('startVote', voteData, function (err, data){
                self.editorInfo.ace_callWithAce(function (ace){
                    ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
                    ace.ace_setAttributeOnSelection(voteId, true);
                    ace.ace_setAttributeOnSelection('vote', true);
                    $('#inline-vote-settings').hide();
                    $("#inline-vote-settings").removeClass('popup-show');
                    var elem = $('iframe[name=ace_outer]').contents().find('iframe[name="ace_inner"]').contents().find('.vote.'+voteId);
                    insertIcons(elem);
                    addVoteClickListeners();
                },'createNewVote', true);
            });
        }
        $('#inline-vote-settings').hide();
        addVoteClickListeners();
    });
}

var isHeading = function (index) {
    var attribs = this.documentAttributeManager.getAttributesOnLine(index);
   for (var i=0; i<attribs.length; i++) {
     if (attribs[i][0] === 'heading') {
       var value = attribs[i][1];
       i = attribs.length;
       return value;
     }
   }
   return false;
 }

// Indicates if Etherpad is configured to display icons
var displayIcons = function() {
    return clientVars.displayCommentAsIcon
}

var insertIconContainer = function () {
    if (!displayIcons()) return;

    $('iframe[name=ace_outer]').contents().find("#sidediv").after('<div id="voteIcons"></div>');
 // getPadOuter().find("#comments").addClass('with-icons');
}

exports.aceInitialized = function(hook, context){
    createVote = _(createVote).bind(context);
    closeVote = _(closeVote).bind(context);
    isHeading = _(isHeading).bind(context);
    handleVoteClose = _(handleVoteClose).bind(context);

    insertIconContainer();
    var padInner = $('iframe[name=ace_outer]').contents().find('iframe[name=ace_inner]').contents().find('body');
    padInner.on('click', function () {
        $('#inline-vote-form').hide();
        $("#inline-vote-form").removeClass('popup-show');
        $('#inline-vote-settings').hide();
        $("#inline-vote-settings").removeClass('popup-show');
        $('#close_confirm').hide();
        $('#close_confirm').removeClass('popup-show');
    });

    $('#inline-vote-form').off('submit');

    $('#cancel-vote').on('click', function () {
        $('#inline-vote-settings').hide();
        $("#inline-vote-settings").removeClass('popup-show');
    });

    $('#cancel-voting').on('click', function () {
        $('#inline-vote-form').hide();
        $("#inline-vote-form").removeClass('popup-show');
    });

    $('.close_popup').on('click', function (e) {
        $(e.target).parent().hide();
        $(e.target).parent().removeClass('popup-show');
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

exports.aceEditEvent = function(hook, call) {
    var cs = call.callstack;
    if (cs.type !== 'idleWorkTimer') {
        addVoteClickListeners();
    }

}

var insertIcons = function (elem) {
    var padOuter = $('iframe[name=ace_outer]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');
    var lineElem = $(elem).closest('.ace-line');
    var paddingFrame = parseInt($(padInner).css('padding-top'));
    var top = lineElem.find('.vote').get(0).offsetTop + parseInt($(lineElem.find('.vote').get(0)).css('padding-top')) + paddingFrame;
    //check if container exists
    var lineClass = 'vote-icons-line-'+lineElem.attr('id');
    if (padOuter.find('#voteIcons').find('.vote-icons-line.'+lineClass).length === 0) {
        padOuter.find('#voteIcons').append('<div class="vote-icons-line '+lineClass+'" style="top:' +top+ 'px;"></div>')
    }
    var voteId = '';

    $.each($(elem)[0].classList, function (index, className) {
        if (className.indexOf('vote-') > -1) {
            voteId = className;
        }
    });
    if (padOuter.find('#voteIcons').find('.'+lineClass).find('.vote-icon.'+voteId).length === 0)
        padOuter.find('#voteIcons').find('.'+lineClass).append('<div class="vote-icon '+voteId+ '"></div>');
};

exports.postAceInit = function () {
    var padOuter = $('iframe[name=ace_outer]').contents();
    var padInner = padOuter.find('iframe[name="ace_inner"]');
    $(padInner).contents().find('.vote').each(function (key, elem) {
       insertIcons(elem);
    });

    addVoteClickListeners();
}
