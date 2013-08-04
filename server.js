var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , crypto = require('crypto');
  
app.listen(8001);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

var rooms = [];

// 1. client send roomHash or no roomHash to the server at init-server
// 2. if client do not provide a roomHash then client gets one, follow step 2.1. When Client provided roomHash, follow step 3.
// 2.1 After Client got roomHash, client sends it back to the server.
// 2.2 After Server got message back it the server verifies it.
// 3. Client is prompted to enter their name and sends roomHash, clientHash and username to the server

io.sockets.on('connection', function (socket) {
	
  socket.on('init-server', initHandler.bind(socket));
  
});

function initHandler(data){
	
	if(!doesRoomExist(data.roomHash)){
		
		var newRoom = createRoom();
		var roomHash = newRoom.hash;
		rooms.push(newRoom);
		
    	this.emit('init-room', { roomHash: roomHash });
	}
	else{
		delete this._events['init-server']; // remove initHandler from socket
		this.once(data.roomHash+'#setup', msgSetupHandler.bind(this));
		this.emit('init-user', { msg: 'room verified' });
	}
	
}

function msgSetupHandler(data){
	
	if(doesRoomExist(data.roomHash)){
		
		var users = getUsersFromRoom(data.roomHash).users;
		
		if(users.length < 2){ // there must be only two users in a game
			
			var enemy = users[0];
			
			insertNewUserIntoRoom(data.roomHash, { hash: data.clientHash, name: data.username, settings: data.settings, grid: data.grid});
		
			this.on(data.roomHash+'#game', msgGameHandler.bind(this));
		
			this.emit(data.to, { msg: 'user#registered', enemy: enemy, your_turn: isFirstUser(data.roomHash) });
			
			this.on('disconnect', disconnectionHandler.bind(this, data.roomHash, data.clientHash));
		}
		else{
			this.emit(data.to, { error: 'room#full' });
		}
	}
	
}

function msgGameHandler(data){
	
	switch(data.msg){
		
		case 'user#draw':
			this.broadcast.emit(data.to, { msg: data.msg, coords: data.coords});
			break;
		
		case 'user#enemy':
			this.broadcast.emit(data.to, { msg: data.msg, enemy: data.enemy });
			break;
	};
	
}

function disconnectionHandler(roomHash, userHash){
	
	var users = getUsersFromRoom(roomHash).users;
	
	if(users.length > 1){
		var tmpUsers = users.filter(function(user, index, array){
    		if(user.hash !== userHash){
        		return user;
			}
		});
		
		this.broadcast.emit(tmpUsers[0].hash, { msg: 'user#leave' });
		
		getUsersFromRoom(roomHash).users = tmpUsers;
	}
	else{
		destroyRoom(roomHash);
	}
}

// helper

function createRoom(){
	return {
		hash: createHash(),
		users:[]
	};
}

function destroyRoom(roomHash){
	rooms = rooms.filter(function(room, index, array){
		if(room.hash !== roomHash){
			return room;
		}
	});
}

var createHash = function(){
  var current_date = (new Date()).valueOf().toString();
  var random = Math.random().toString();
  return crypto.createHash('sha1').update(current_date + random).digest('hex');
};

function isFirstUser(roomHash){
	var users = getUsersFromRoom(roomHash).users;
	return users.length === 1;
}

function doesRoomExist(roomHash){
	for(var r=0; r < rooms.length; r++){
		var room = rooms[r];
		if(roomHash === room.hash){
			return true;
		}
	}
	return false;
}

function getUsersFromRoom(roomHash){
	for(var r=0; r < rooms.length; r++){
		var room = rooms[r];
		if(roomHash === room.hash){
			return room;
		}
	}
	return [];
}

function doesFirstGamerExist(users){
	return users[0];
}

function insertNewUserIntoRoom(roomHash,user){
	for(var r=0; r < rooms.length; r++){
		var room = rooms[r];
		if(roomHash === room.hash){
			room.users.push(user);
		}
	}
}
