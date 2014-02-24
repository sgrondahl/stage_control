
/*global $SESSION Stage SyncStage Module FlowController Transition $*/

var initialize = new Stage({
    onEnter : function() {
        $SESSION.GUI.set('url', 'initial');
    }
});

var inst = new Stage({
    onEnter : function() {
	// Should take no time at all.
        $SESSION.newstage();
        $SESSION.GUI.set('url', 'instructions');
    }
});

var exp = new Stage({
    onEnter : function() {
        $SESSION.newstage();
        $SESSION.GUI.set('url', 'experiment');
    },
    minTime : 3,
    maxTime : 3
});

var cur_loop = 1,
    numSpokes = 6;

var chat = new Stage({
    onEnter : function(i) {
        $SESSION.GUI.set('open_chats', [cur_loop + i * numSpokes], i);
    },
    minTime : 3,
    maxTime : 3
});

var sync = new SyncStage({
    onEnter : function(player) {
	console.log('player '  + player + ' entering sync');
    },
    onExit : function(group) {
	console.log('onexit');
	console.log(group);
	++cur_loop;
    }
});

var chat_loop = new Module({ stages : [chat, sync] });
chat_loop.loop({ continueIf : function() { return cur_loop <= 3; } });

var goodbye = new Stage({
    onEnter : function() {
        $SESSION.GUI.set('url', 'goodbye');
    }
});

chat_loop.goesTo(goodbye);

chat.goesTo(sync);

exp.goesTo(chat_loop);

inst.goesTo(exp);

initialize.goesTo(inst);
    

var FC = new FlowController(initialize);
$(function() {
    $SESSION.start(FC);
});
