/*global $SESSION*/

var FlowController = (function FlowControllerClosuer() {
    function FlowController(start) {
	if (!start instanceof Stage) throw new Error('flow controller must be given a starting stage');
	
	this.__stack = [];
	for (var i = 0; i < $SESSION.players.length; i++) {
            this.__stack[i] = [start];
	}
    }

    FlowController.prototype = {
	start : function() {
	    $SESSION.on('pulse', this.step.bind(this));
	    for (var i = 0; i < this.__stack.length; i++) {
		var ns = this.__stack[i][0].enter();
		this.__stack[i].pop();
		if (ns instanceof Array) this.__stack[i] = this.__stack[i].concat(ns);
		else this.stack[i][0] = ns;
	    }
	},
	step : function() {
	    //$SESSION.log('step');
	    $SESSION.GUI.set('timer', $SESSION.stagetime());
	    var some_alive = false;
	    for (var i = 0; i < this.__stack.length; i++) {
		// Don't overflow the stack!
		var stack_protector = 0;
		while (this.__stack[i].length > 0 && this.__stack[i][this.__stack[i].length - 1] === undefined)  {
		    if (stack_protector++ > 10) throw new Error('overflowed the stack in step!');
		    this.__stack[i].pop();
		}
		
		//$SESSION.log('popped stack, val is ' + this.__stack[i]);

		if (this.__stack[i].length === 0) continue; // Don't move if player already dead.

		some_alive = true;
		var cs = this.__stack[i][this.__stack[i].length - 1],
		    ns = cs.step();

		this.__stack[i].pop();
		this.__stack[i] = this.__stack[i].concat(ns); // Stack pushes will be arrays.
	    }

	    return some_alive;
	},
	t : function() {
	    $SESSION.log('stepping fc');
	}
    };
    
    return FlowController;
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
	    if (!s2 instanceof Stage) throw new Error('goesTo requires Stage argument');
	    
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
	exit : function() {
	    this.onExit();
	},
	step : function() {
	    var stime = $SESSION.sessiontime() - this.startTime;
	    if (stime >= this.minTime && (stime >= this.maxTime || this.exitIf())) {
		// Pop up if undefined.
		if (this.transitions.length == 0) return undefined;
		
		for (var i = 0; i < this.transitions.length; i++) {
		    if (this.transitions[i].when()) {
			this.exit();
			return this.transitions[i].target.enter();
		    }
		}
	    }
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
	    if (typeof w !== 'function') throw new Error('when requires a function that evaluates to boolean');
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
		if (typeof $SESSION.memory._$STAGE !== 'object') $SESSION.memory._$STAGE = {};
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
	    if (!s2 instanceof Stage) throw new Error('goesTo requires Stage argument');
	    
	    var t = new Transition({ origin : this,
				     target : s2 });
	    this.transitions.push(t);
	    return t;
	},
	enter : function(entries) {
	    this.initialize();
	    if (entries === undefined || !entries instanceof Array) entries = [this];
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


this.exports = {
    FlowController : FlowController,
    Stage : Stage,
    Module : Module 
};

