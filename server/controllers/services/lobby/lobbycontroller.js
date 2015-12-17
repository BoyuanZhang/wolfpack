var paths = require('../../../paths'),
	lobbyutil = require(paths.controllers + '/services/util/chat/lobby/lobbyutil'),
	ldhandler = require(paths.datahandler + '/lobby/lobby'),
	responseservice = require(paths.service + '/response/responseservice'),
	responsehelper = require(paths.controllers + '/services/helper/responsehelper'),
	accountcontroller = require(paths.controllers + '/services/account/accountcontroller'),
	auth = require(paths.security + '/auth');


var controller = {
	'lobbyExists': function(req, res) {
		var reqBody = req.body;
		if(!lobbyutil.validateExist(reqBody)) {
			responsehelper.handleBadRequest(res);
			return;
		}

		var lobbyId = reqBody.lobbyId;
		ldhandler.lobbyExists(lobbyId, function(exists, err) {
			var data = {}, ret;
			if(!exists && !err) {
				data.lobbyExists = true;
			} else {
				data.lobbyExists = false;					
			}
			ret = responseservice.buildBasicResponse(data);
			res.json(ret);	
		});
	},
	'fetchChat': function(req, res) {
		var reqBody = req.body;
		if(!lobbyutil.validateFetch(reqBody)) {
			responsehelper.handleBadRequest(res);
			return;
		}

		var lobbyId = reqBody.lobbyId;
		ldhandler.findLobby(lobbyId, function(success, lobby) {
			var data = {}, ret;
			if(success && lobby) {
				data.fetchSuccess = true;
				data.chatLog = lobby.chatLog;
			} else {
				data.fetchSuccess = false;	
			}
			ret = responseservice.buildBasicResponse(data);
			res.json(ret);		
		});
	},
	'leaveLobby': function(req, res) {
		var reqBody = req.body, reqQuery = req.query;
		if(!lobbyutil.validateLeave(reqBody, reqQuery)) {
			responsehelper.handleBadRequest(res);
			return;
		}

		var lobbyId = reqBody.lobbyId, paddedEmail = auth.getPaddedEmailFromQuery(reqQuery);

		ldhandler.leaveLobby(lobbyId, paddedEmail, function(left) {
			var data = {}, ret;
			if(left) {
				callbacks.leaveCb(lobbyId, paddedEmail);
				data.leftLobby = true;
			} else {
				data.leftLobby = false;
			}
			ret = responseservice.buildBasicResponse(data);
			res.json(ret);
		});
	},
	'createLobby': function(lobbyId, paddedEmail, callback) {
		if(!lobbyutil.validateCreate(lobbyId, paddedEmail)) {
			callback(false);
			return;
		}

		ldhandler.lobbyExists(lobbyId, function(exists) {
			if(!exists) {
				ldhandler.createLobby(lobbyId, paddedEmail, function(success) {
					if(success) {
						callbacks.createCb(lobbyId, paddedEmail);
						callback(true);
					} else {
						callback(false);					
					}	
				})
			} else {
				callback(false);	
			}
		});
	},
	'updateChat': function(lobbyId, msg, callback) {
		if(!lobbyutil.validateUpdate(lobbyId, msg)) {
			callback(false);
		}

		ldhandler.updateChat(lobbyId, msg, function(success) {
			callback(success);
		})
	},
	'userInLobby': function(lobbyId, email, callback) {
		if(!lobbyutil.validateUserInLobby(lobbyId, email)) {
			callback(false);
		}

		ldhandler.findLobby(lobbyId, function(success, result) {
			if(!success || !result || !result.users) {
				callback(false);
				return;
			}

			var users = result.users;

			if(users.indexOf(email) > -1) {
				callback(true);
			} else {
				callback(false);
			}
		});
	},
	'joinLobby': function(paddedEmail, lobbyId, callback) {
		if(!lobbyutil.validateJoin(lobbyId, paddedEmail)) {
			callback(false);
		}

		ldhandler.joinLobby(lobbyId, paddedEmail, function(success) {
			if(success) {
				callbacks.joinCb(lobbyId, paddedEmail);
				callback(true);
			} else {
				callback(false);
			}
		});
	},
	//[BZ] TODO: This is pretty much duplicated by the lobbyExists function above, except that function 
	// needs a request and response object. Is there a way to re-use this exist function instead of
	// having duplicate functions essentially? Also using this.exists above does not work because
	// exists loses context. What is the best way to get the context of 'this' to call functions inside
	// our controller
	'exists': function(lobbyId, callback) {
		if(!lobbyId) {
			callback(false);
		}
		ldhandler.lobbyExists(lobbyId, function(exists, err) {
			callback(exists, err);
		});
	},
	'destroyLobby': function(lobbyId, creatorEmail, callback) {
		if(!lobbyutil.validateDestroy(lobbyId, creatorEmail)) {
			callback(false);
		}

		ldhandler.findCreatorLobby(lobbyId, creatorEmail, function(found, lobbyObj) {
			if(!found || !lobbyObj) {
				callback(false);
				return;
			}

			ldhandler.destroyChat(lobbyId, creatorEmail, function(destroyed) {
				if(destroyed) {
					callbacks.destroyCb(lobbyObj);
					callback(true);
				} else {
					callback(false);
				}
			});
		});
	},
	'addUserToLobby': function(lobbyId, paddedEmail, callback) {
		if(!lobbyutil.validateAddToLobby(lobbyId, paddedEmail)) {
			callback(false);
		}

		ldhandler.joinLobby(lobbyId, paddedEmail, function(success) {
			if(success) {
				callback(true);
			} else {
				callback(false);
			}
		});
	}
};

module.exports = controller;

var callbacks = {
	'createCb': function(lobbyId, paddedEmail) {
		accountcontroller.addLobby(lobbyId, paddedEmail, function(joined) {
			if(!joined) {
				//[BZ] TODO: if lobby was not added to the account we should error handle this somehow.
			}
		});

		controller.addUserToLobby(lobbyId, paddedEmail, function(joined) {
			if(!joined) {
				//[BZ] TODO: if person was not added to this lobby we should error handle this somehow.				
			}
		});
	},
	'joinCb': function(lobbyId, paddedEmail) {
		accountcontroller.addLobby(lobbyId, paddedEmail, function(joined) {
			if(!joined) {
				//[BZ] TODO: if lobby was not added to user's account we should handle this somehow.
			}
		})
	},
	'destroyCb': function(lobbyObj) {
		if(!lobbyObj && !lobbyObj.lobbyId && !lobbyObj.users) {
			//[BZ] TODO: There should always be a lobby object, if there is not handle this error.
			return;
		}

		var lobbyId = lobbyObj.lobbyId, lobbyUsers = lobbyObj.users;
		accountcontroller.removeLobbies(lobbyId, lobbyUsers, function(removed) {
			if(!removed) {
				//[BZ] TODO: if person did not join this lobby we should error handle this somehow.
			}
		});
	},
	'leaveCb': function(lobbyId, paddedEmail) {
		accountcontroller.removeLobby(lobbyId, paddedEmail, function(removed) {
			if(!removed) {
				//[BZ] TODO: if person did not join this lobby we should error handle this somehow.
			}
		});		
	}
}