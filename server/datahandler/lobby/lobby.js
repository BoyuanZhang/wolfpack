var paths = require('../../paths'),
	dbclient = require(paths.database + '/client'),
	lobbyFactory = require(paths.model + '/lobby');

var data_lobby = {
	'lobbyExists': function(lobbyId, callback) {
		var db = dbclient.get(), lobby = db.collection('lobby');

		lobby.count({lobbyId: lobbyId}, function(err, count) {
			if( err ) {
				callback(false);
			}
			//[BZ] TODO: the count here 2 is hard-coded, and should be replaced with a config constant value in the future
			else if( count > 0) {
				callback(true);
			}
			else {
				callback(false);
			}
		});
	},
};

module.exports = data_lobby;