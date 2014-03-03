
/*global $SESSION Stage SyncStage Module FlowController Transition $*/

var round_time = 2;

function isSeller(player) {
    return player % 2 == 0;
}

function allHaveAccepted() {
    var acceptances = $SESSION.db.find('acceptances', {});
    for (var i = 0; i < $SESSION.players.length; ++i) {
        if (acceptances.filter(function(v) { return v.player === i || v.proposer === i; }).length === 0) {
            return false;
        }
    }
    return true;
}

$SESSION.memory.round = 1;


var instructions = new Stage({
    onEnter : function() {
        $SESSION.GUI.set('url', 'instructions');
    },
    fixedTime : 2
});

var buyer_propose = new Stage({
    onEnter : function(player) {
        $SESSION.log('buyer propose for player ' + player + 'in round ' + $SESSION.memory.round);
        if (isSeller(player)) {
            $SESSION.GUI.set('url', 'propose', player);
        } else {
            $SESSION.GUI.set('url', 'receive', player);
        }
        $SESSION.GUI.set('round', $SESSION.memory.round);
    },
    fixedTime : round_time
});

var seller_accept = new Stage({
    onEnter : function(player) {
        $SESSION.log('seller accept for player ' + player+ 'in round ' + $SESSION.memory.round);
        if (isSeller(player)) {
            $SESSION.GUI.set('url', 'receive', player);
        } else {
            var current_proposals = $SESSION.db.find('proposals', {round : $SESSION.memory.round}),
                processed_proposals = [];
            for (var i = 0; i < current_proposals.length; ++i) {
                processed_proposals.push(current_proposals[i].player + ' : ' + current_proposals[i].amount);
            }
            $SESSION.GUI.set('proposals', processed_proposals, player);
            $SESSION.GUI.set('url', 'accept', player);
        }
    },
    fixedTime : round_time
});

var seller_accept_sync = new SyncStage({});

seller_accept_sync.endsWhen(allHaveAccepted);


var seller_propose = new Stage({
    onEnter : function(player) {
        $SESSION.log('seller propose for player ' + player+ 'in round ' + $SESSION.memory.round);
        if (!isSeller(player)) {
            $SESSION.GUI.set('url', 'propose', player);
        } else {
            $SESSION.GUI.set('url', 'receive', player);
        }
        $SESSION.GUI.set('round', $SESSION.memory.round);
    },
    fixedTime : round_time
});

var buyer_accept = new Stage({
    onEnter : function(player) {
        $SESSION.log('buyer accept for player ' + player+ 'in round ' + $SESSION.memory.round);
        if (!isSeller(player)) {
            $SESSION.GUI.set('url', 'receive', player);
        } else {
            var current_proposals = $SESSION.db.find('proposals', {round : $SESSION.memory.round}),
                processed_proposals = [];
            for (var i = 0; i < current_proposals.length; ++i) {
                processed_proposals.push(current_proposals[i].player + ' : ' + current_proposals[i].amount);
            }
            $SESSION.GUI.set('proposals', processed_proposals, player);
            $SESSION.GUI.set('url', 'accept', player);
        }
    },
    fixedTime : round_time
});

var buyer_accept_sync = new SyncStage({
    onExit : function(group) {
        $SESSION.memory.round += 1;
    }
});

var propose_accept_loop = new Module({
    stages : [buyer_propose, seller_accept, seller_accept_sync, seller_propose, buyer_accept, buyer_accept_sync]
});

propose_accept_loop.loop({
    continueIf : function() {
        $SESSION.log('continuoing propose accept loop');
        return !allHaveAccepted();
    }
});

var reveal = new Stage({
    onEnter : function() {
        $SESSION.GUI.set('url', 'feedback');
        var proposals = $SESSION.db.find('proposals', {});
        $SESSION.GUI.set('proposals', proposals);
    }
});


instructions.goesTo(propose_accept_loop);
buyer_propose.goesTo(seller_accept);
seller_accept.goesTo(seller_propose).when(function() { return !allHaveAccepted(); });
//seller_accept.goesTo(seller_accept_sync);
//seller_accept_sync.goesTo(seller_propose);
seller_propose.goesTo(buyer_accept);
buyer_accept.goesTo(buyer_accept_sync);
propose_accept_loop.goesTo(reveal);

var FC = new FlowController(instructions);
$(function() {
    $SESSION.start(FC);
});
