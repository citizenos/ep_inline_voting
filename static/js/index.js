'use strict';

const _ = require('ep_etherpad-lite/static/js/underscore');

const loc = document.location;
const port = loc.port === '' ? (loc.protocol === 'https:' ? 443 : 80) : loc.port;
const url = `${loc.protocol}//${loc.hostname}:${port}/` + 'vote';
const socket = io.connect(url, {forceNew: true});
const cssFiles = ['ep_inline_voting/static/css/vote.css'];
const Security = require('ep_etherpad-lite/static/js/security');

const lastLineSelectedIsEmpty = (rep, lastLineSelected) => {
  const line = rep.lines.atIndex(lastLineSelected);
  // when we've a line with line attribute, the first char line position
  // in a line is 1 because of the *, otherwise is 0
  const firstCharLinePosition = (line.lineMarker === 1) ? 1 : 0;
  const lastColumnSelected = rep.selEnd[1];

  return lastColumnSelected === firstCharLinePosition;
};

const getAuthorName = (authorID) => {
  const authors = clientVars.collab_client_vars.historicalAuthorData;
  if (authors[authorID]) {
    return authors[authorID].name;
  }

  return null;
};

const getLastLine = (rep) => {
  const firstLine = rep.selStart[0];
  let lastLineSelected = rep.selEnd[0];

  if (lastLineSelected > firstLine) {
    // Ignore last line if the selected text of it it is empty
    if (lastLineSelectedIsEmpty(rep, lastLineSelected)) {
      lastLineSelected--;
    }
  }
  return lastLineSelected;
};

let isHeading = function (index) {
  const attribs = this.documentAttributeManager.getAttributesOnLine(index);
  for (let i = 0; i < attribs.length; i++) {
    if (attribs[i][0] === 'heading') {
      const value = attribs[i][1];
      i = attribs.length;
      return value;
    }
  }
  return false;
};

const cloneLine = (line) => {
  const padOuter = $('iframe[name="ace_outer"]').contents();
  const padInner = padOuter.find('iframe[name="ace_inner"]');

  const lineElem = $(line.lineNode);
  const lineClone = lineElem.clone();
  const innerOffset = $(padInner).offset().left;
  const innerPadding = parseInt(padInner.css('padding-left') + lineElem.offset().left);
  const innerdocbodyMargin = innerOffset + innerPadding || 0;
  padInner.contents().find('body').append(lineClone);
  lineClone.css({position: 'absolute'});
  lineClone.css(lineElem.offset());
  lineClone.css({left: innerdocbodyMargin});
  lineClone.width(lineElem.width());

  return lineClone;
};

// Given a rep we get the X and Y px offset
const getXYOffsetOfRep = (rep) => {
  let selStart = rep.selStart;
  let selEnd = rep.selEnd;
  // make sure end is after start
  if (selStart[0] > selEnd[0] || (selStart[0] === selEnd[0] && selStart[1] > selEnd[1])) {
    selEnd = selStart;
    selStart = _.clone(selStart);
  }

  let startIndex = 0;
  const endIndex = selEnd[1];
  const lineIndex = selEnd[0];
  if (selStart[0] === selEnd[0]) {
    startIndex = selStart[1];
  }

  const padInner = $('iframe[name="ace_outer"]').contents().find('iframe[name="ace_inner"]');

  // Get the target Line
  const startLine = rep.lines.atIndex(selStart[0]);
  const endLine = rep.lines.atIndex(selEnd[0]);
  const clone = cloneLine(endLine);
  let lineText = Security.escapeHTML($(endLine.lineNode).text()).split('');
  lineText.splice(endIndex, 0, '</span>');
  lineText.splice(startIndex, 0, '<span id="selectWorker">');
  lineText = lineText.join('');

  const heading = isHeading(lineIndex);
  if (heading) {
    lineText = `<${heading}>${lineText}</${heading}>`;
  }
  $(clone).html(lineText);

  // Is the line visible yet?
  if ($(startLine.lineNode).length !== 0) {
    const worker = $(clone).find('#selectWorker');
    // A standard generic offset'
    let top = worker.offset().top + padInner.offset().top + parseInt(padInner.css('padding-top'));
    let left = worker.offset().left;
    // adjust position
    top += worker[0].offsetHeight;

    if (left < 0) {
      left = 0;
    }
    // Remove the clone element
    $(clone).remove();
    return [left, top];
  }
};

// Draws the toolbar onto the screen
const drawAt = (element, XY) => {
  element.show();
  element.addClass('popup-show');
  element.css({
    position: 'absolute',
    left: XY[0],
    top: XY[1],
  });
};

const buildUserVote = (voteId, option) => {
  const vote = {};

  vote.voteId = voteId;
  vote.value = option;
  vote.padId = clientVars.padId;
  vote.author = clientVars.userId;
  vote.createdAt = new Date().getTime();

  return vote;
};

const vote = (voteId) => {
  const option = $('.vote-option-radio:checked').val();
  if (voteId && option) {
    const vote = buildUserVote(voteId, option);
    socket.emit('addVote', vote, (err, vote) => {
      if (err) return console.error(err);
    });
  }

  $('#inline-vote-form').hide();
  $('#inline-vote-form').removeClass('popup-show');
  return false;
};

const getDateTimeString = (timestamp) => {
  const d = new Date(timestamp);

  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${(`0${d.getMinutes()}`).substr(-2)}`;
};

const _getXY = (voteId) => {
  const padOuter = $('iframe[name="ace_outer"]');
  const padInner = padOuter.contents().find('body').find('iframe[name="ace_inner"]');
  const outOffset = padOuter.offset();
  const topPadding = parseInt(padOuter.css('padding-top'));
  const topMargin = parseInt(padOuter.css('margin-top'));
  const correction = outOffset.top + padInner.offset().top + topPadding + topMargin;
  const h = padInner.contents().find(`.${voteId}`).height();
  return [
    padInner.offset().left + padInner.contents().find(`.${voteId}`).offset().left,
    padInner.contents().find(`.${voteId}`).offset().top + h + correction,
  ];
};

const getVoteCount = (voteId) => {
  socket.emit('getVoteSettings',
      {
        padId: clientVars.padId,
        voteId, authorID: clientVars.userId,
      }, (err, voteSettings) => {
        socket.emit('getVoteCount',
            {
              padId: clientVars.padId,
              voteId, authorID: clientVars.userId,
            }, (err, result) => {
              const countHTML = html10n.get('ep_inline_voting.total_votes', {count: result.count});
              $('#vote-count').text(countHTML);
              $('#creator-name').text(getAuthorName(voteSettings.author));
              $('#create-time').text(getDateTimeString(voteSettings.createdAt));
              $('#description-content').text(voteSettings.description);

              let itemHtml = '';
              _.each(voteSettings.options, (option) => {
                let userVote = false;
                if (result.userOption && result.userOption === option) {
                  userVote = true;
                }

                itemHtml += `<div class="option-wrap"> \
                            <div class="option-result-bar-wrap"> \
                                <label class="container"> \
                                    <input \
                                          class="vote-option-radio" type="radio" \
                                          name="option" \
                                          value="${option}" ${(userVote) ? 'checked' : ''} \
                                    /> \
                                    <span class="checkmark"></span> \
                                    <div class="option-value-active">${option}</div> \
                                </label> \
                            </div> \
                        </div>`;
              });

              $('#vote-options-list').html(itemHtml);
              $('#inline-vote-settings').hide();
              $('#inline-vote-settings').removeClass('popup-show');
              drawAt($('#inline-vote-form'), _getXY(voteId));
            });
      });
};

const getVoteResult = (voteId) => {
  socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, (err, voteSettings) => {
    if (err) {
      return console.error(err);
    }

    $('#creator-name').text(getAuthorName(voteSettings.author));
    $('#create-time').text(getDateTimeString(voteSettings.createdAt));
    $('#description-content').text(voteSettings.description);

    socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, (err, result) => {
      if (err) console.error(err);
      let itemHtml = '';
      let totalVotes = 0;

      $.each(Object.keys(result), (key, item) => {
        totalVotes += result[item].length;
      });

      $.each(Object.keys(result), (key, item) => {
        let vcount = 0;
        let userVote = false;
        if (result && result[item]) {
          vcount = result[item].length;
          result[item].filter((voter) => {
            if (voter.author === clientVars.userId) {
              userVote = true;
            }
          });
        }
        let barLength = 0;
        let resultText = item;
        let valueText = '';
        if (voteSettings && voteSettings.closed) {
          barLength = ((vcount / totalVotes * 100) || 1) + ((vcount / totalVotes) ? '%' : 'px');
          resultText = (vcount || 0);
          valueText = item;
          $('#vote-form-buttons-wrap').hide();
        }

        itemHtml += `<div class="option-wrap">
                    <div class="option-result-bar-wrap">
                        <label class="container">
                            <input
                              class="vote-option-radio"
                              type="radio" name="option"
                              value="${item}" ${(userVote) ? 'checked' : ''}
                            />
                            <span class="checkmark"></span>
                            <div class="option-result-bar">
                                <div class="option-result-fill" style="width:${barLength};">
                                    <div class="option-result-votes">${resultText}</div>
                                </div>
                            </div>
                        </label>
                        <div class="option-value">${valueText}</div>
                    </div>
                </div>`;
      });

      $('#vote-options-list').html(itemHtml);
      if (voteSettings && voteSettings.closed) {
        $('.vote-option-radio').attr('disabled', true);
      }
      $('#inline-vote-settings').hide();
      $('#inline-vote-settings').removeClass('popup-show');
      drawAt($('#inline-vote-form'), _getXY(voteId));
    });
  });
};

const addVoteClickListeners = () => {
  const padOuter = $('iframe[name="ace_outer"]');
  const padInner = padOuter.contents().find('body').find('iframe[name="ace_inner"]');

  const voteClickListeners = (key, elem) => {
    $(elem).off();
    $(elem).on('click', (e) => {
      if ($('.popup').is(':visible') && $('.popup').hasClass('popup-show')) {
        $('.popup').hide();
        $('.popup').removeClass('popup-show');
      } else {
        $('#vote-form-buttons-wrap').show();
        $('.vote-option-radio').attr('disabled', false);
        const voteId = e.currentTarget.classList.value.match(/(vote-[0-9]+)=?/g)[0];
        $('#close-vote').off();
        $('#close-vote').on('click', (e) => {
          handleVoteClose(voteId, e);
        });
        $('#save-vote').off();
        $('#save-vote').on('click', () => {
          vote(voteId);
        });
        if (voteId) {
          socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, (err, voteSettings) => {
            if (err) {
              return console.error(err);
            }

            if (voteSettings.closed) {
              getVoteResult(voteId);
            } else {
              getVoteCount(voteId);
            }
          });
        }
      }
    });
  };

  $(padOuter).contents().find('.vote-icon').each(voteClickListeners);
  $(padInner).contents().find('.vote').each(voteClickListeners);
};

let closeVote = function (padId, voteId) {
  const padOuter = $('iframe[name=ace_outer]').contents();
  const padInner = padOuter.find('iframe[name=ace_inner]').contents().find('body');
  const editorInfo = this.editorInfo;

  socket.emit('updateVoteSettings', {padId, voteId, settings: {closed: true}}, () => {
    const rep = editorInfo.ace_getRepFromSelector(`.${voteId}`, padInner);
    editorInfo.ace_callWithAce((ace) => {
      ace.ace_performSelectionChange(rep[0][0], rep[0][1], true);
      ace.ace_setAttributeOnSelection('voteClosed', true);
      $('#inline-vote-settings').hide();
      $('#inline-vote-settings').removeClass('popup-show');
      addVoteClickListeners();
    }, 'closeVote', true);
  });
};

const handleVoteClose = (voteId, triger) => {
  socket.emit('getVoteSettings', {padId: clientVars.padId, voteId}, (err, voteData) => {
    if (err) {
      return console.error(err);
    }

    socket.emit('getVoteResult', {padId: clientVars.padId, voteId}, (err, result) => {
      if (err) console.error(err);

      let winner = null;
      let votecount = 0;
      $.each(result, (key, item) => {
        if (!winner || item.length > votecount) {
          winner = key;
          votecount = item.length;
        } else if (winner && votecount > 0 && item.length === votecount) {
          winner = null;
          $.gritter.add({
            title: 'Error',
            text: 'Vote cannot be closed, tie',
            class_name: 'error',
          });
          return;
        }
      });

      if (winner) {
        const XY = [
          $(triger.target).closest('.popup').offset().left,
          $(triger.target).closest('.popup').offset().top,
        ];

        drawAt($('#close_confirm'), XY);
        $('#vote_selected_text').html(voteData.selectedText);
        $('#vote_winner_text').html(winner);
        $('#vote_button_keep').on('click', () => {
          closeVote(clientVars.padId, voteId);
          $('#close_confirm').hide();
          $('#close_confirm').removeClass('popup-show');
          $('#inline-vote-form').hide();
          $('#inline-vote-form').removeClass('popup-show');
        });

        $('#vote_button_replace').on('click', () => {
          const padOuter = $('iframe[name="ace_outer"]').contents();
          const padInner = padOuter.find('iframe[name="ace_inner"]');

          const padVoteContent = padInner.contents().find(`.${voteData.voteId}`).first();
          winner = winner.replace(/(?:\r\n|\r)/g, '<br />');

          $(padVoteContent).html(winner);
          $('#close_confirm').hide();
          $('#close_confirm').removeClass('popup-show');
          $('#inline-vote-form').hide();
          $('#inline-vote-form').removeClass('popup-show');
          closeVote(clientVars.padId, voteId);
        });
      }
    });
  });
};

const getSelectedText = function (rep) {
  const lastLine = getLastLine(rep);
  let posStart = 0;
  let posEnd = 0;

  const line = rep.lines.atIndex(lastLine);

  if (rep.selStart[0] === lastLine) {
    // Is this the first line?
    if (rep.selStart[1] > 0) {
      posStart = rep.selStart[1];
    }
  }

  if (rep.selEnd[0] === lastLine) {
    if (rep.selEnd[1] <= line.text.length) {
      posEnd = rep.selEnd[1];
    }
  }
  return line.text.substring(posStart, posEnd);
};

// Indicates if Etherpad is configured to display icons
const displayIcons = () => clientVars.displayCommentAsIcon;

const insertIconContainer = () => {
  if (!displayIcons()) return;

  $('iframe[name=ace_outer]').contents().find('#sidediv').after('<div id="voteIcons"></div>');
  // getPadOuter().find("#comments").addClass('with-icons');
};

const insertIcons = (elem) => {
  const padOuter = $('iframe[name=ace_outer]').contents();
  const padInner = padOuter.find('iframe[name="ace_inner"]');
  const lineElem = $(elem).closest('.ace-line');
  const firstLinePadding = $(lineElem).parent().children().get(0).offsetTop;
  const top = $(lineElem).find('.vote').get(0).offsetTop - firstLinePadding;
  // check if container exists
  const lineClass = `vote-icons-line-${lineElem.attr('id')}`;
  if (padOuter.find('#voteIcons').find(`.vote-icons-line.${lineClass}`).length === 0) {
    padOuter.find('#voteIcons').append(`<div
      class="vote-icons-line ${lineClass}"
      style="top:${top}px;"></div>`);
  }
  let voteId = '';

  $.each($(elem)[0].classList, (index, className) => {
    if (className.indexOf('vote-') > -1) {
      voteId = className;
    }
  });
  const lineItem = padOuter.find('#voteIcons').find(`.${lineClass}`);
  if (padOuter.find('#voteIcons').find(`.vote-icon.${voteId}`).length === 0) {
    lineItem.append(`<div class="vote-icon ${voteId}"></div>`);
  }
};

let createVote = function () {
  const self = this;
  const rep = self.rep;
  const now = new Date().getTime();
  const defaultOptionText = getSelectedText(rep);

  $('#vote-description-area').val('');
  $('#vote-description-area').attr('placeholder', html10n.get('ep_inline_voting.vote_title_label'));
  const XY = getXYOffsetOfRep(rep);
  $('#inline-vote-form').hide();
  $('#inline-vote-form').removeClass('popup-show');
  $('#close_confirm').hide();
  $('#close_confirm').removeClass('popup-show');
  drawAt($('#inline-vote-settings'), XY);

  let itemCount = 0;
  $('.vote-option-input').each((key, item) => {
    itemCount++;
    item.value = '';
    if (itemCount > 2) {
      item.remove();
    }
  });
  $('#vote-option-1').val(defaultOptionText);
  $('#start-vote').off();
  $('#start-vote').on('click', () => {
    const options = [];
    const description = $('#vote-description-area').val() || '';
    $('.vote-option-input').each((key, item) => {
      if (item.value) {
        options.push(item.value);
      }
    });
    const voteId = `vote-${now}`; // Get more uniqueID
    const voteData = {
      voteId,
      createdAt: now,
      description,
      options,
      selectedText: defaultOptionText,
      padId: clientVars.padId,
      author: clientVars.userId,
      closed: false,
    };

    if (options.length && options.length > 1) {
      socket.emit('startVote', voteData, (err, data) => {
        self.editorInfo.ace_callWithAce((ace) => {
          ace.ace_performSelectionChange(rep.selStart, rep.selEnd, true);
          ace.ace_setAttributeOnSelection(voteId, true);
          ace.ace_setAttributeOnSelection('vote', true);
          $('#inline-vote-settings').hide();
          $('#inline-vote-settings').removeClass('popup-show');
          const padOuter = $('iframe[name=ace_outer]').contents();
          const elem = padOuter.find('iframe[name="ace_inner"]').contents().find(`.vote.${voteId}`);
          insertIcons(elem);
          addVoteClickListeners();
        }, 'createNewVote', true);
      });
    }
    $('#inline-vote-settings').hide();
    addVoteClickListeners();
  });
};

exports.aceInitialized = function (hook, context) {
  createVote = _(createVote).bind(context);
  closeVote = _(closeVote).bind(context);
  isHeading = _(isHeading).bind(context);

  insertIconContainer();
  const padOuter = $('iframe[name=ace_outer]').contents();
  const padInner = padOuter.find('iframe[name=ace_inner]').contents().find('body');
  padInner.on('click', () => {
    $('#inline-vote-form').hide();
    $('#inline-vote-form').removeClass('popup-show');
    $('#inline-vote-settings').hide();
    $('#inline-vote-settings').removeClass('popup-show');
    $('#close_confirm').hide();
    $('#close_confirm').removeClass('popup-show');
  });

  $('#inline-vote-form').off('submit');

  $('#cancel-vote').on('click', () => {
    $('#inline-vote-settings').hide();
    $('#inline-vote-settings').removeClass('popup-show');
  });

  $('#cancel-voting').on('click', () => {
    $('#inline-vote-form').hide();
    $('#inline-vote-form').removeClass('popup-show');
  });

  $('.close_popup').on('click', (e) => {
    $(e.target).closest('.popup').hide();
    $(e.target).closest('.popup').removeClass('popup-show');
  });


  $('#inline-vote-add-option').on('click', () => {
    if ($('#vote-options-wrap .vote-option-input').length < 5) {
      const itemIndex = $('#vote-options-wrap .vote-option-input').length + 1;
      const optionInput = `<div class="option-wrap">
      <input
        class="vote-option-input"
        type="text" id="vote-option-${itemIndex}"
        name="vote-option-${itemIndex}"/>
      <div class="remove-vote-option"></div>
      </div>`;
      $('#vote-options-wrap').find('.option-wrap:last-child').before(optionInput);
      $('.remove-vote-option').off();
      $('.remove-vote-option').on('click', function () {
        if ($('.remove-vote-option').length > 2) {
          $(this).parent().remove();
        } else {
          $(this).parent().find('input').val('');
        }
      });
    }
  });
  $('.remove-vote-option').on('click', function () {
    if ($('.remove-vote-option').length > 2) {
      $(this).parent().remove();
    } else {
      $(this).parent().find('input').val('');
    }
  });
};

exports.aceAttribsToClasses = (hook, context) => {
  if (context.key.indexOf('vote') === 0) {
    return [context.key];
  }
};

exports.aceEditEvent = (hook, call) => {
  const cs = call.callstack;
  if (cs.type !== 'idleWorkTimer') {
    addVoteClickListeners();
  }
};

exports.postAceInit = () => {
  const padOuter = $('iframe[name=ace_outer]').contents();
  const padInner = padOuter.find('iframe[name="ace_inner"]');
  $(padInner).contents().find('.vote').each((key, elem) => {
    insertIcons(elem);
  });

  addVoteClickListeners();
};

exports.aceEditorCSS = () => cssFiles;
exports.postToolbarInit = (hookName, args) => {
  const editbar = args.toolbar;

  editbar.registerCommand('createVote', () => {
    createVote();
    addVoteClickListeners();
  });
};
