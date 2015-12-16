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
		this.exists(lobbyId, function(exists, err) {
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
		ldhandler.fetchChat(lobbyId, function(success, element) {
			var data = {}, ret;
			if(success && element) {
				data.fetchSuccess = true;
				data.chatLog = element.chatLog;
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

		var lobbyId = reqBody.lobbyId, userEmail = auth.getPaddedEmailFromQuery(reqQuery);

		ldhandler.leaveLobby(lobbyId, userEmail, function(left) {
			var data = {}, ret;
			if(left) {
				accountcontroller.removeLobby(userEmail, lobbyId, function(removed) {
					if(!removed) {
						//[BZ] TODO: if person did not join this lobby we should error handle this somehow.
					}
				});
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
						var userObj = auth.buildUserObjFromPaddedEmail(paddedEmail);
						callbacks.createCb(lobbyId, userObj.email, userObj.facebookuser, paddedEmail);
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
	'exists': function(lobbyId, callback) {
		if(!lobbyId) {
			callback(false);
		}
		ldhandler.lobbyExists(lobbyId, function(exists, err) {
			callback(exists, err);
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
	'joinLobby': function(creatorEmail, lobbyId, callback) {
		if(!lobbyutil.validateJoin(lobbyId, creatorEmail)) {
			callback(false);
		}

		ldhandler.joinLobby(lobbyId, creatorEmail, function(success) {
			if(success) {
				var userObj = auth.buildUserObjFromPaddedEmail(creatorEmail);
				callbacks.joinCb(lobbyId, userObj.email, userObj.facebookuser);
				callback(true);
			} else {
				callback(false);
			}
		});
	},
	'destroyLobby': function(lobbyId, creatorEmail, callback) {
		if(!lobbyutil.validateDestroy(lobbyId, creatorEmail)) {
			callback(false);
		}

		ldhandler.destroyChat(lobbyId, creatorEmail, function(destroyed) {
			if(destroyed) {
				accountcontroller.removeLobby(creatorEmail, lobbyId, function(removed) {
					if(!removed) {
						//[BZ] TODO: if person did not join this lobby we should error handle this somehow.
					}
				});
				callback(true);
			} else {
				callback(false);
			}
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
	'createCb': function(lobbyId, userEmail, facebookuser, paddedEmail) {
		accountcontroller.addLobby(lobbyId, userEmail, facebookuser, function(joined) {
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
	'joinCb': function(lobbyId, userEmail, facebookuser) {
		accountcontroller.addLobby(lobbyId, userEmail, facebookuser, function(joined) {
			if(!joined) {
				//[BZ] TODO: if lobby was not added to user's account we should handle this somehow.
			}
		})
	}
}