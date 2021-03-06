'use strict';

exports.collectContentPre = (hook, context, cb) => {
  const vote = /(?:^| )(vote-[A-Za-z0-9]*)/.exec(context.cls);

  if (vote && vote[1]) {
    context.cc.doAttrib(context.state, 'vote');
    context.cc.doAttrib(context.state, vote[1]);
  }
  const closed = /(?:^| )(voteClosed*)/.exec(context.cls);
  if (closed && closed[1]) {
    context.cc.doAttrib(context.state, 'voteClosed');
  }

  return cb();
};
