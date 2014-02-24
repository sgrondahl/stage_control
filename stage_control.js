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
	var all_group = new Group($SESSION.players, 'all');

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
                var ns = this.__stack[i][0].enter(i);
		// Pop the start stage off and add on the stack returned my enter.
                this.__stack[i].pop();
                if (ns instanceof Array) {
		    this.__stack[i] = this.__stack[i].concat(ns);
                } else {
		    this.stack[i][0] = ns;
		}
            }
        },
        step : function() {
	    // Update the timer on each step.
            $SESSION.GUI.set('timer', $SESSION.stagetime());
	    // Keep track of whether any players are still in the stages,
	    // else end the session.
            var some_alive = false;

	    // Iterate through players (indices of __stack).
            for (var i = 0; i < this.__stack.length; i++) {
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
                    ns = cs.step();
                
                this.__stack[i].pop();
                this.__stack[i] = this.__stack[i].concat(ns); // Stack pushes will be arrays.
            }
        
            if (!some_alive) {
                $SESSION.end();
            }
        },
        t : function() {
            $SESSION.log('stepping fc');
        }
    };
    
    return FlowController;
})();

var SyncStage = (function SyncStageClosure() {
    function SyncStage(kwargs) {
	if (typeof kwargs !== 'object') {
	    kwargs = {};
	}

	this.onEnter = typeof kwargs.onEnter === 'function' ? kwargs.onEnter : function() {};
	this.onExit = typeof kwargs.onExit === 'function' ? kwargs.onExit : function() {};
	this.onFirstEnter = typeof kwargs.onFirstEnter === 'function' ? kwargs.onFirstEnter : function() {};
	this.onLastEnter = typeof kwargs.onLastEnter === 'function' ? kwargs.onLastEnter : function() {};
    }

    SyncStage.prototype = {
	goesTo : function(s2) {
	    return Stage.prototype.goesTo.call(this, s2);
	},
	enter : function(i) {
	    return Stage.prototype.enter.call(this, i);
	},
	exit : function(i) {
	    return Stage.prototype.exit.call(this, i);
	},
	step : function(i) {
	    return Stage.prototype.step.call(this, i);
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
        enter : function(wrap) {
            this.startTime = $SESSION.sessiontime();
            /* TODO: use this to pop out of the wrapper in the middle, make required arg. */
            this.parent = wrap;
            this.onEnter();
            return [this];
        },
        exit : function(i) {
            this.onExit(i);
        },
        step : function(j) {
            var stime = $SESSION.sessiontime() - this.startTime;

	    // Try to step forward from this stage. Only allowed
	    // if we've reached the min time AND either also reached
	    // the max time OR meet the exitif condition.
            if (stime >= this.minTime && (stime >= this.maxTime || this.exitIf(j))) {
		
		// If there are no transitions out of here, return
		// undefined to indicate to the flowcontroller that
		// we should pop up to the next highest stage in the stack.
                if (this.transitions.length === 0) {
		    return undefined;
		}
                
		// Otherwise, look through all transitions and find the
		// first where we meet the when condition.
                for (var i = 0; i < this.transitions.length; i++) {
                    if (this.transitions[i].when(j)) {
                        this.exit(j);
                        return this.transitions[i].target.enter(j);
                    }
                }
            }

	    // If we can't do anything, return this stage (we stay
	    // in the current stage.
            return this;
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
        this.entry = kwargs.stages[0];
        this.maxTime = typeof kwargs.maxTime === 'number' ? kwargs.maxTime : -1;
        this.transitions = [];
        this.initialize = function() { };
        this.continueIf = function() { return false; };
        this.iterate = function() { };
    }

    Module.prototype = {
        loop : function(kwargs) {
            if (typeof kwargs.loop === 'number' && typeof kwargs.loopName === 'string') {
                if (typeof $SESSION.memory._$STAGE !== 'object') {
                        $SESSION.memory._$STAGE = {};
                }
                this.initialize = function() { this.initialized = true; $SESSION.memory._$STAGE[kwargs.loopName] = 0; };
                this.iterate = function() { $SESSION.memory._$STAGE[kwargs.loopName] += 1; };
                this.continueIf = function() { return $SESSION.memory._$STAGE[kwargs.loopName] < kwargs.loop; };
            } else {
                this.initialize = typeof kwargs.initialize === 'function' ? kwargs.initialize : function() { };
                this.iterate = typeof kwargs.iterate === 'function' ? kwargs.iterate : function() { };
                this.continueIf = typeof kwargs.continueIf === 'function' ? kwargs.continueIf : function() { return false; };
            }
    
            return this;
        },
        step : function() {
            this.iterate();
            if (this.continueIf()) {
                this.entry.enter(this);
                return [this, this.entry];
            } else {            
                for (var i = 0; i < this.transitions.length; i++) {
                    if (this.transitions[i].when()) {
                        this.exit();
                        this.transitions[i].target.enter();
                        return [this.transitions[i].target];
                    }
                }
                
                return undefined;
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
        enter : function(entries) {
            this.initialize();
            if (entries === undefined || !entries instanceof Array) {
                entries = [this];
            }
            
            if (this.entry instanceof Module) {
                entries.push(this.entry);
                return this.entry.enter(entries);
            } else {
                entries = entries.concat(this.entry.enter(this));
                return entries;
            }
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

