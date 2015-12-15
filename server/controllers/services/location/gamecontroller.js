var paths = require('../../../paths'),
	gdhandler = require(paths.datahandler + '/location/game'),
	gameutil = require('../util/location/gameutil'),
	responseservice = require(paths.service + '/response/responseservice'),
	responsehelper = require(paths.controllers + '/services/helper/responsehelper'),
	lobbycontroller = require(paths.controllers + '/services/lobby/lobbycontroller'),
	auth = require(paths.security + '/auth');

var controller = {
	'create': function(req, res) {
		if(!gameutil.validateGameReq(req.body)) {
			responsehelper.handleBadRequest(res);
			return;
		}

		var createObj = req.body, creatorEmail = auth.getPaddedEmailFromQuery(req.query);

		gdhandler.isCreateAllowed(creatorEmail, createObj.game, function(allowed) {
			var data = {}, ret;
			if(allowed) {
				gdhandler.createGame(creatorEmail, createObj, function(success, gameObj) {
					if(success && gameObj) {
						data.gameCreated = true;
						lobbycontroller.createLobby(gameObj.gameId, creatorEmail, function(created) {
							if(!created) {
								//[BZ] TODO: Lobby could not be created, this situation needs to be handled somehow
							}
						});
					} else if(success) {
						//[BZ] TODO: Game object was not returned by mongo, needs to be handled somehow
						data.gameCreated = true;
					}
					else {
						data.gameCreated = false;					
					}
					ret = responseservice.buildBasicResponse(data);
					res.json(ret);	
				});
			}
			else {
				data.gameCreated = false;
				ret = responseservice.buildBasicResponse(data);
				res.json(ret);
			}
		});
	},

	'find': function(req, res) {
		if(!gameutil.validateGameFind(req.body)) {
			responsehelper.handleBadRequest(res);
			return;
		}

		var data = {}, ret;
		gdhandler.findGames(req.body, function(success, elements) {
			if(success && elements && elements.length > 0) {
				data.gamesFound = true;
				data.games = elements;
			}
			else {
				data.gamesFound = false;
			}
			ret = responseservice.buildBasicResponse(data);
			res.json(ret);
		});
	},

	'destroy': function(req, res) {
		if(!gameutil.validateDestroy(req.body)) {
			responsehelper.handleBadRequest(res);
			return;			
		}

		var data = {}, ret, gameId = req.body.gameId, creatorEmail = auth.getPaddedEmailFromQuery();
		gdhandler.destroyGame(gameId, creatorEmail, function(success) {
			if(success) {
				data.gameDestroyed = true;
				lobbycontroller.destroyLobby(gameId, creatorEmail, function(destroyed) {
					if(!destroyed) {
						//[BZ] TODO: if lobby was not deleted we should error handle this somehow.
					}
				});
			}
			else {
				data.gameDestroyed = false;
			}

			ret = responseservice.buildBasicResponse(data);
			res.json(ret);
		});
	}
};

module.exports = controller;