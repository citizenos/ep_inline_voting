var collectContentPre = function(hook, context){
    var vote = /(?:^| )(vote-[A-Za-z0-9]*)/.exec(context.cls);
    if(comment && comment[1]){
      context.cc.doAttrib(context.state, "vote::" + vote[1]);
    }
  };
  
  exports.collectContentPre = collectContentPre;
  