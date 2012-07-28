
var HAND_SIZE = 5
, MAX_DIE = 6
, BUYIN = 10

function Bid() {
    this.player    = null
    this.name      = 'initial'
    this.face      = 0
    this.quantity  = 1
}

function Game() {
    this.time        = new Date().getTime();
    this.state         = 'open'
    this.turn          = null
    this.turnOrder       = []
    this._bid          = new Bid()
}

var game;

var liarspoker_init = function(player){
	game = new Game();
	game.turn = player.id
	game.turnOrder = [player.id]
	return game
}

var get_hand = function(){
	var hand = []
	while (hand.length < HAND_SIZE) { hand.push( Math.floor(Math.random() * MAX_DIE + 1 )) }
	return hand
}

var liarspoker_join = function(socket){
	if(!id) id = mongoose.Types.ObjectId()
	console.log("game.join", gameName, id) // Add the player to the game
	if(!game){
		console.log("new game")
		game = new Game({name:gameName})
		game.save()
	}
	var player = game.players.id(id)
	if(!player){
		player = new Player({"_id": id} )
		// Give the person a hand
		while (player.hand.length < HAND_SIZE) { player.hand.push( Math.floor(Math.random() * MAX_DIE +1 )) }
		game.players.push(player)
	}
	if(!game.turn) game.turn = player._id.toString()
	var bid = new Bid()
	bid.save()
	if(!game._bid) game._bid = bid
	game.save(function(err){
		Game.findById(game._id).populate('_bid').exec(cb)
	})
}

var liarspoker_leave = function(gameId, id, cb){
	console.log("game.leave", gameId, id)
	Game.findById(gameId).populate('_bid').exec(function(err, game){
		if(!game) return cb("Game not found")
		var player = game.players.id(id)
		if(player){
			if(game.turn == player._id.toString()){
				if(game.players.length <= 1)
					game.turn = null
				else{
					var players = _.map(game.players, function(val, key){; return val._id.toString() })
					var i = _.indexOf(players, game.turn)
					game.turn = game.players[(i+1) % game.players.length]._id.toString()	
				}
			}
			game.players.id(id).remove()
			game.save(function(err){
				Game.findById(game._id).populate('_bid').exec(cb)
			})			
		}
	})
}

var liarspoker_name = function(gameId, id, name, cb){
	Game.findById(gameId).exec(function(err, game){
		console.log("Game", game)
		game.players.id(id).name = name
		game.save(function(err){
			Game.findById(game._id).populate('_bid').exec(cb)
		})

	})
}

var liarspoker_bid = function(gameId, uuid, bid, cb){
	console.log("game.bid", gameId, bid) // Set the bid
	Game.findById(gameId).exec(function(err, game){
		// If it's the person's turn: set the bid, make the turn the next player's
		var bidObject = new Bid(bid)
		bidObject.player = uuid
		bidObject.save()
		// Next player is it
		game._bid = bidObject // Not sure how the populated object will handle this
		var players = _.map(game.players, function(val, key){; return val._id.toString() })
		var i = _.indexOf(players, game.turn)
		game.turn = game.players[(i+1) % game.players.length]._id.toString()
		game.save(function(err){
			Game.findById(game._id).populate('_bid').exec(cb)
		})
	})
}

var liarspoker_challenge = function(gameId, uuid, cb){
	console.log("game.challenge", gameId, uuid) // End the round, determine winner
	Game.findById(gameId).populate('_bid').exec(function(err, game){
		if(game.turn != uuid){
			cb("It is not your turn")
			return
		}
		// Gather all the hands
		var allDice = []
		_.each(game.players, function(player){ allDice = allDice.concat(player.hand) })
		var totalQuantity = 0
		_.each(allDice, function(num){ if(num == game._bid.face) totalQuantity += 1})
		var winner = (game._bid.quantity > totalQuantity) ? game.turn : game._bid.player // challenger : bidder
		var spoils = game.players.length - 1
		
		_.each(game.players, function(player){
			player.score += (player._id.toString() == winner) ? spoils : -1
		})

		game.turn = winner
		game.state = 'result'
		game.bid = new Bid()
		game.save(function(err){
			Game.findById(game._id).populate('_bid').exec(cb)
		})
		
	})
}

var liarspoker_next = function(gameId, cb){
	console.log("game.next", gameId)
	Game.findById(gameId).populate('_bid').exec(function(err, game){
		// Give the players new hands
		_.each(game.players, function(player){
			player.hand.length = 0
			player.hand = new Array()
			while (player.hand.length < HAND_SIZE) { player.hand.push( Math.floor(Math.random() * MAX_DIE +1 )) }
		})
		game.state = 'open'
		var bid = new Bid()
		bid.save()
		game._bid = bid
		game.save(function(err){
			Game.findById(game._id).populate('_bid').exec(cb)
		})
	})
}