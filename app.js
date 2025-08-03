const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 3001;

let players = {};
let chess = new Chess(); // Use 'let' instead of 'const'
let timers = {};
let timerInterval = null;

const startGame = () => {
    // Stop any existing timer to prevent duplicates
    if (timerInterval) clearInterval(timerInterval);

    // Reset game state
    chess = new Chess();
    timers = { w: 600, b: 600 }; // 10 minutes per player

    io.emit('boardState', chess.fen());
    io.emit('timerUpdate', timers);
    console.log("Game started. Timers initiated:", timers);

    // Start the game clock
    timerInterval = setInterval(() => {
        const turn = chess.turn();
        if (timers[turn] > 0) {
            timers[turn]--;
            // Emit the updated time to all clients every second
            io.emit('timerUpdate', timers);
        } else {
            // If time runs out, end the game
            endGame({ winner: turn === 'w' ? 'Black' : 'White', reason: 'Time Out' });
        }
    }, 1000);
};

const endGame = (result) => {
    // Stop the clock
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    
    io.emit('gameOver', result);
};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'Chess Game' });
});

io.on('connection', function (uniquesocket) {
    console.log("A user connected:", uniquesocket.id);

    // Assign roles to players
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit('playerRole', 'w');
        console.log(`Player ${uniquesocket.id} assigned as White.`);
        console.log("Current players:", players);
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit('playerRole', 'b');
        console.log(`Player ${uniquesocket.id} assigned as Black.`);
        console.log("Current players:", players);
        // This is the critical point, let's see if we get here
        startGame();
    } else {
        uniquesocket.emit('spectatorRole');
        console.log(`User ${uniquesocket.id} is a spectator.`);
    }

    uniquesocket.emit('boardState', chess.fen());

    uniquesocket.on('disconnect', function () {
        console.log("A user disconnected:", uniquesocket.id);
        if (uniquesocket.id === players.white) {
            delete players.white;
        } else if (uniquesocket.id === players.black) {
            delete players.black;
        }
    });

    uniquesocket.on('move', (move) => {
        try {
            const turn = chess.turn();
            if ((turn === 'w' && uniquesocket.id !== players.white) ||
                (turn === 'b' && uniquesocket.id !== players.black)) {
                return;
            }

            const result = chess.move(move);

            if (result) {
                io.emit('move', move);
                io.emit('boardState', chess.fen());

                if (chess.isCheck()) {
                    // The player whose turn it is now is in check
                    io.emit('check', { player: chess.turn() });
                }

                // --- GAME OVER CHECK USING CHESS.JS ---
                if (chess.isGameOver()) {
                    let winner = 'None';
                    let reason = '';

                    if (chess.isCheckmate()) {
                        winner = turn === 'w' ? 'White' : 'Black';
                        reason = 'Checkmate';
                    } else if (chess.isDraw()) {
                        reason = 'Draw';
                        if (chess.isStalemate()) {
                            reason = 'Stalemate';
                        } else if (chess.isThreefoldRepetition()) {
                            reason = 'Threefold Repetition';
                        } else if (chess.isInsufficientMaterial()) {
                            reason = 'Insufficient Material';
                        }
                    }
                    
                    io.emit('gameOver', { winner, reason });
                }
                // --- END OF GAME OVER CHECK ---

            } else {
                uniquesocket.emit('invalidMove', { move });
            }
        } catch (err) {
            console.error("Error processing move:", err);
            uniquesocket.emit('invalidMove', { move });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
