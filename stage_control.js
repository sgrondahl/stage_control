/*global $SESSION*/

var Group = (function GroupClosure() {
    function Group(fc, players, name) {
	this.fc = fc;
	this.players = players;
	this.name = name;
    }

    Group.prototype = {
	partition : function(players, name) {
	    if (!players instanceof Array) {
		throw new Error('Group.partition must have an array of players to put into the group');
	    }
	    
	    if (players.length !== this.players.length) {
		throw new Error('Group.partition requires allocation for every player in the current group.');
	    }

	    for (var i = 0; i < players.length; i++) {
		var player_index = this.players[i];
		
	    }
	    
	    // TODO: implement.
	    throw new Error('not implemented.');
	},
	advancePlayer : function(player, ns) {
	    console.log('advance ' + player);
	    console.log(this.fc.__stack[player]);
	    this.fc.__stack[player].pop();
	    this.fc.__stack[player] = this.fc.__stack[player].concat(ns);
	    console.log(this.fc.__stack[player]);
	}
    };

    return Group;
})();

var FlowController = (function FlowControllerClosure() {
    function FlowController(start) {
        if (!start instanceof Stage) {
	    throw new Error('flow controller must be given a starting stage');
	}

	// __stack is an array of player indexed stacks
	// of stages/modules that the player hasn't exited.
	// Since it is possible to enter another stage/loop/module
	// and then pop back up to the entering stage/loop/module,
	// we need to keep track.
        this.__stack = [];

	// __groups is an array of player indexed stacks
	// of groups.
	this.__groups = [];
	var all_group = new Group(this, $SESSION.players, 'all');

        for (var i = 0; i < $SESSION.players.length; i++) {
	    // For each player, the stack is just the start stage.
            this.__stack[i] = [start];

	    // For each player, the default group is the 'all' group.
	    this.__groups[i] = [all_group];
        }

    }

    FlowController.prototype = {
        start : function() {
	    // When FlowController is started, register to try a step 
	    // each time pulse is called.
            $SESSION.on('pulse', this.step.bind(this));

	    // Iterate over the players (__stack is indexed by player).
            for (var i = 0; i < this.__stack.length; i++) {
		// Enter the start stage (only array element) for each players.
		// The enter method returns the current stage, or if multiple
		// fell through, a stack of where we are.
                var groups = this.__groups[i],
		    ns = this.__stack[i][0].enter(i, groups[groups.length - 1], groups);
		// Pop the start stage off and add on the stack returned my enter.
                this.__stack[i].pop();
                if (ns instanceof Array) {
		    this.__stack[i] = this.__stack[i].concat(ns);
                }
            }
        },
	// FlowController.step
        step : function() {
	    // Update the timer on each step.
            $SESSION.GUI.set('timer', $SESSION.stagetime());
	    // Keep track of whether any players are still in the stages,
	    // else end the session.
            var some_alive = false;

	    // Iterate through players (indices of __stack).
            for (var i = 0; i < this.__stack.length; i++) {
		console.log(i);
		console.log(this.__stack[i]);
                // Don't overflow the stack!
                var stack_protector = 0;
		// Eat off stages that are undefined.
                while (this.__stack[i].length > 0 && 
		       this.__stack[i][this.__stack[i].length - 1] === undefined)  {
                    if (stack_protector++ > 10) {
			throw new Error('overflowed the stack in step!');
		    }
                    this.__stack[i].pop();
                }
                
		// Don't move if player already dead.
		// Empty __stack means dead because there
		// are no more stages to go to.
                if (this.__stack[i].length === 0) {
		    continue;
		}

                some_alive = true;

		// cs == current_stage,
		// ns == next_stage.
		// Get this player's current stage and advance
		// it to get the next stage(s), then put these
		// on the player's __stack.
                var cs = this.__stack[i][this.__stack[i].length - 1],
		    groups = this.__groups[i],
                    ns = cs.step(i, groups[groups.length - 1], groups);
                
                this.__stack[i].pop();
                this.__stack[i] = this.__stack[i].concat(ns); // Stack pushes will be arrays.
            }
        
            if (!some_alive) {
                $SESSION.end();
            }
        }
    };
    
    return FlowController;
})();

var SyncStage = (function SyncStageClosure() {
    function SyncStage(kwargs) {
	if (typeof kwargs !== 'object') {
	    kwargs = {};
	}

	Stage.call(this, kwargs);

	this.onEnter = typeof kwargs.onEnter === 'function' ? kwargs.onEnter : function() {};
	this.onExit = typeof kwargs.onExit === 'function' ? kwargs.onExit : function() {};
	this.onFirstEnter = typeof kwargs.onFirstEnter === 'function' ? kwargs.onFirstEnter : function() {};
	this.onLastEnter = typeof kwargs.onLastEnter === 'function' ? kwargs.onLastEnter : function() {};

	this.groups = [];
	this.lastEnteredGroups = [];
	this.players = [];
	this.playerMap = [];
    }

    SyncStage.prototype = {
	goesTo : function(s2) {
	    return Stage.prototype.goesTo.call(this, s2);
	},
	enter : function(player, group, groups) {
	    // If we haven't yet seen this group.
	    if (this.groups.indexOf(group) < 0) {
		// Remember that we are holding this group.
		this.groups.push(group);
		// And we haven't yet called onLastEnter on it.
		// (Indices should match with groups).
		this.lastEnteredGroups.push(false);
		// Since we haven't yet seen this group, call
		// onFirstEnter on in.
		this.onFirstEnter(group);
	    }

	    this.players.push(player);

	    // Call onEnter for this player.
	    this.onEnter(player);
	    
	    // Try to move the current user group forward.
	    return this.tryMoveGroup(player, group, groups);

	    //return Stage.prototype.enter.call(this, player, group);
	},
	tryMoveGroup : function(player, group, groups) {
	    var group_index = this.groups.indexOf(group);
	    // Check if we are holding onto all members of the group.
	    // If we didn't return, we have all the players in the group.
	    // Otherwise, take no action (stay in the same syncstage).
	    for (var i = 0; i < group.players.length; ++i) {
		if (this.players.indexOf(group.players[i]) < 0) {
		    // console.log('missing player!');
		    // console.log(group.players[i]);
		    // console.log(group.players);
		    // console.log(this.players);
		    return [this];
		}
	    }

	    if (!this.lastEnteredGroups[group_index]) {
		// If we haven't called last enter on this group yet,
		// do it now (we have all of the players).
		this.onLastEnter(group);
		this.lastEnteredGroups[group_index] = true;
	    }

	    var next_stages = group.players.map(function(p) { Stage.prototype.step.call(this, p, group, groups); });

	    console.log(next_stages);
	    
	    // If next stage is not the same as this, the group has 
	    // exited, so remove it.
	    if (next_stages.filter(function(v) { return v === this; }).length === 0) {
		this.groups.splice(group_index, 1);
		this.lastEnteredGroups.splice(group_index, 1);
		this.players = this.players.filter(function(p) { return group.players.indexOf(p) < 0; });
		this.onExit(group);
		for (var p = 0; p < next_stages.length; p++) {
		    group.advancePlayer(p, next_stages[p]);
		}
		return [undefined];
	    } else {
		console.log('return this');
		return [this];
	    }
	},
	exit : function(i) {
	    return Stage.prototype.exit.call(this, i);
	},
	// SyncStage.step
	step : function(player, group, groups) {
	    if (this.playerMap[player] !== undefined) {
		var ns = this.playerMap[player],
		    pi = this.playerMap.indexOf(player);
		this.playerMap.splice(pi, 1);
		return [undefined];
	    } else {
		return this.tryMoveGroup(player, group, groups);
	    }
	}
    };

    return SyncStage;
})();

    
var Stage = (function StageClosure() {
    function Stage(kwargs) {
        if (typeof kwargs !== 'object') kwargs = {};
        this.onEnter = typeof kwargs.onEnter === 'function' ? kwargs.onEnter : function() { };
        this.onExit = typeof kwargs.onExit === 'function' ? kwargs.onExit : function() { };
        this.exitIf = typeof kwargs.exitIf === 'function' ? kwargs.exitIf : function() { return true; };
        this.minTime = typeof kwargs.minTime === 'number' && kwargs.minTime >= 0 ? kwargs.minTime : -1;
        this.maxTime = typeof kwargs.maxTime === 'number' && kwargs.maxTime >= 0 ? kwargs.maxTime : -1;
        this.transitions = kwargs.transitions instanceof Array ? kwargs.transitions : [];
	this.$STAGE = {};
    }

    Stage.prototype = {
        clone : function() {
            return new Stage({
                    onEnter : this.onEnter,
                    onExit : this.onExit,
                    exitIf : this.exitIf,
                    minTime : this.minTime,
                    maxTime : this.maxTime,
                    transitions : this.transitions });
        },
        goesTo : function(s2) {
            if (!s2 instanceof Stage) {
		throw new Error('goesTo requires Stage argument');
	    }
    
            var t = new Transition({ origin : this,
                                     target : s2 });

            this.transitions.push(t);
            return t;
        },
        enter : function(player, group, groups) {
            this.startTime = $SESSION.sessiontime();
	    // previously took wrap as only argument
            /* TODO: use this to pop out of the wrapper in the middle, make required arg. */
            // this.parent = wrap;
            this.onEnter(player, group, groups);
	    return this.step(player, group, groups);
        },
        exit : function(player, group, groups) {
            this.onExit(player, group, groups);
        },
	// Stage.step
        step : function(player, group, groups) {
            var stime = $SESSION.sessiontime() - this.startTime;

	    // Try to step forward from this stage. Only allowed
	    // if we've reached the min time AND either also reached
	    // the max time OR meet the exitif condition.
            if (stime >= this.minTime && (stime >= this.maxTime || this.exitIf(player, group, groups))) {
		
		// If there are no transitions out of here, return
		// undefined to indicate to the flowcontroller that
		// we should pop up to the next highest stage in the stack.
                if (this.transitions.length === 0) {
		    return [undefined];
		}
                
		// Otherwise, look through all transitions and find the
		// first where we meet the when condition.
                for (var i = 0; i < this.transitions.length; i++) {
                    if (this.transitions[i].when(player, group, groups)) {
                        this.exit(player, group, groups);
                        return this.transitions[i].target.enter(player, group, groups);
                    }
                }
            }

	    // If we can't do anything, return this stage (we stay
	    // in the current stage.
            return [this];
        }
    };

    return Stage;
})();


var Transition = (function TransitionClosure() {
    function Transition(kwargs) {
	this.origin = kwargs.origin;
	this.target = kwargs.target;
	this.when = typeof kwargs.when === 'function' ? kwargs.when : function() { return true; };
    }

    Transition.prototype = {
        when : function(w) {
            if (typeof w !== 'function') {
                throw new Error('when requires a function that evaluates to boolean');
            }
            this.when = w;
        }
    };


    return Transition;
})();

var Module = (function ModuleClosure() {
    function Module(kwargs) {
        /* TODO validation for stages. */
	// kwargs.stages is an array of stages inside the module.
	// Order doesn't matter, except that the entry stage for the
	// module must be the first stage listed.
        this.entry = kwargs.stages[0];

	// kwargs.maxTime is the maximum time to be in the module.
	// Subjects will be kicked out of the module if this time
	// is reached (and they aren't already out).
        this.maxTime = typeof kwargs.maxTime === 'number' ? kwargs.maxTime : -1;
	
	// Array of transitions out of module. The module will
	// try to transition away if it finishes an internal stage
	// with no internal transitions, or if maxTime is reached.
        this.transitions = [];

	// Called once when the module is entered for the first time.
        this.initialize = function() { };

	// Called to check whether the module should loop again.
        this.continueIf = function() { return false; };

	// Called each time the module loops.
        this.iterate = function() { };
    }

    Module.prototype = {
	// Generate a loop for this module.
        loop : function(kwargs) {

	    // Expect a loop (number) and loopName (string) param to construct a loop.
            if (typeof kwargs.loop === 'number' && typeof kwargs.loopName === 'string') {
		var loop_num;
                // if (typeof $SESSION.memory._$STAGE !== 'object') {
                //         $SESSION.memory._$STAGE = {};
                // }
                this.initialize = function() { loop_num = 0; }; //this.initialized = true; $SESSION.memory._$STAGE[kwargs.loopName] = 0; };
                this.iterate = function() { loop_num++; }; //$SESSION.memory._$STAGE[kwargs.loopName] += 1; };
                this.continueIf = function() { return loop_num < kwargs.loop; }; //$SESSION.memory._$STAGE[kwargs.loopName] < kwargs.loop; };
            } else {
		// Also allow custom initialize, iterate, and continueIf methods.
                this.initialize = typeof kwargs.initialize === 'function' ? kwargs.initialize : function() { };
                this.iterate = typeof kwargs.iterate === 'function' ? kwargs.iterate : function() { };
                this.continueIf = typeof kwargs.continueIf === 'function' ? kwargs.continueIf : function() { return false; };
            }
    
            return this;
        },
	// Module.step
	// Step on a module is only called when we pop back up
	// to the module in __stages.
        step : function(player, group, groups) {
	    console.log('module stepping for player ' + player);
	    // Iterate through the module (if looped).
            this.iterate(player, group, groups);

            if (this.continueIf(player, group, groups)) {
		console.log('meet continue if');
		// If the loop continues, push this
		// back onto the top of the stack, along
		// with any inner Stages/Modules we enter.
                return [this].concat(this.entry.enter(player, group, groups));
            } else {
		console.log('dont meet continueif');
		console.log(this.continueIf);
		console.log(this.continueIf(player, group, groups));
		// Try to exit through any possible transitions.
                for (var i = 0; i < this.transitions.length; i++) {
                    if (this.transitions[i].when(player, group, groups)) {
                        this.exit(player, group, groups);
                        return this.transitions[i].target.enter(player, group, groups);
                    }
                }

                // If we can't exit into any transitions, pop back up.
                return [undefined];
            }
        },
        goesTo : function(s2) {
            if (!s2 instanceof Stage) {
                throw new Error('goesTo requires Stage argument');
            }
            
            var t = new Transition({ origin : this,
                                     target : s2 });
            this.transitions.push(t);
            return t;
        },
        enter : function(player, group, groups) {
	    // When module entered, initialize the loop.
            this.initialize();

	    // Put this module onto the stack, then also 
	    // push on any inner modules and return.
	    return [this].concat(this.entry.enter(player, group, groups));
        },
        exit : function() { }
    };

    return Module;
})();


/*this.exports = {
    FlowController : FlowController,
    Stage : Stage,
    Module : Module 
};*/

