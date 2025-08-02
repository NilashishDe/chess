const express = require('express');
const socket = require('socket.io');
const http = require('http');
const {Chess} = require('chess.js');
const path = require('path');
const { title } = require('process');
const { log } = require('console');
const app = express();

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();

let players={};
let currentPlayer = 'w';

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index',{title: 'Chess Game'});
});

io.on('connection', function(uniquesocket) {
    console.log("connected");
    
    if(!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole', 'w');
    }
    else if(!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole', 'b');
    } else {
        uniquesocket.emit('spectatorRole');
        return;
    }

    uniquesocket.on('disconnect', function() {
        if(uniquesocket.id === players.white) {
            delete players.white;
        }
        else if(uniquesocket.id === players.black) {
            delete players.black;
        }
    });

    uniquesocket.on('move',(move) => {
        try{
            if(chess.turn()==='white' && uniquesocket.id !== players.white ) return;
            if(chess.turn()==='black' && uniquesocket.id !== players.black ) return;

            const result = chess.move(move);

            if(result) {
                currentPlayer = chess.turn();
                io.emit('move',move);
                io.emit('boardState', chess.fen());
            }
            else{
                console.log("Invalid move attempted:", move);
                uniquesocket.emit('invalidMove', move);
            }

        }
        catch(err){
            console.error("Error processing move:", err);
            uniquesocket.emit('invalidMove', move);
        }
        
    });
});

server.listen(4000, function() {
    console.log('Server is running on port 4000');
});
