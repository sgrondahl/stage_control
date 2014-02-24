/*global _$GUI _$PLAYERS _$TIME prettyPrint*/

var _$GUI = [],
    _$PLAYERS = [0,1,2,3,4,5,6,7],
    _$SESSION = {
	__db__ : {},

	DB_write : function(table, obj) {
	    if (!_$SESSION.__db__.hasOwnProperty(table)) {
		_$SESSION.__db__[table] = [];
	    }

	    _$SESSION.__db__[table].push(obj);
	},

	DB_find : function(table, obj) {
	    return _$SESSION.__db__.hasOwnProperty(table) ? _$SESSION.__db__[table] : [];
	},

	__alive__ : true,

	END : function() {
	    _$SESSION.__alive__ = false;
	    alert('Session ended...');
	},

	__start__ : new Date(),

	Time : function() {
	    return parseInt((new Date() - _$SESSION.__start__)/1000.0, 10);
	}
    };

var $SESSION = {

    start : function(fc) {
	var el = document.getElementById('gui'),
	    maxTime = 40;
	_$SESSION.__start__ = new Date();
	fc.start();
	(function step() {
	    var time = (new Date() - _$SESSION.__start__)/1000.0;
	    console.log(' T I M E ::::::: ' + parseInt(time));
	    fc.step();
	    // Update the output on the screen.
	    el.innerHTML = prettyPrint(_$GUI);
	    if (_$SESSION.__alive__ && time <= maxTime) {
		window.setTimeout(step, 1000);
	    }
	})();
    },

    GUI : {
	set : function(field, data, player) { 
	    if (player !== undefined) {
		var player_num = parseInt(player, 10);
		if (isNaN(player_num) || player_num >= _$PLAYERS.length) {
		    throw new Error("Error: when supplying three arguments to GUI.set, the third argument must be a valid player index. Expected a number between 0 and " + _$PLAYERS.length + " but got " + player_num);
		}
		if (_$GUI[player] === undefined) {
		    _$GUI[player] = {};
		}
		_$GUI[player][field] = data;
	    } else {
		for (var i = 0; i < _$PLAYERS.length; i++) {
		    if (_$GUI[i] === undefined) _$GUI[i] = {};
		    _$GUI[i][field] = data;
		}
	    }
	}, 
	get : function(field, player) { 
	    if (typeof player === 'number')
		return _$GUI[player] === undefined ? undefined : _$GUI[player][field];
	    else
		return _$GUI[0] === undefined ? undefined : _$GUI[0][field];
	}
    },

    players : _$PLAYERS,

    db : {
	write : function(table, obj) {
	    if (typeof table !== 'string' || typeof obj !== 'object') {
		throw new Error("Argument error in $SESSION.db.write");
	    }

	    _$SESSION.DB_write(table, obj);
	},
	find : function(table, obj) {
	    if (typeof table !== 'string' || typeof obj !== 'object') {
		throw new Error("Argument error in $SESSION.db.write");
	    }

	    return _$SESSION.DB_find(table, obj);
	}
    },

    log : function(tolog) {
	console.log('Session log: ' + JSON.stringify(tolog));
    },

    end : function() { _$SESSION.END(); },

    sessiontime : function() { return _$SESSION.Time(); },

    memory : {},

    on : function() {},

    stagetime : function() { return _$SESSION.Time(); },

    newstage : function() {}

};
