const socket = io();
const chess = new Chess();
const boardElement = document.querySelector('.chessboard');
const messageElement = document.getElementById('message');

let draggedPiece= null;
let sourceSquare = null;
let playerRole = null;
let isGameOver = false;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = '';
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement('div');
            squareElement.classList.add(
                'square',
                (rowIndex + squareIndex) % 2 === 0 ? 'light' : 'dark'
            );
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;
        
            if(square) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece', square.color==='w'? "white": "black");
                pieceElement.innerText = getPieceUnicode(square);
                pieceElement.draggable = playerRole === square.color;
                pieceElement.draggable = playerRole === square.color && !isGameOver;

                pieceElement.addEventListener('dragstart', (e) => {
                    if(pieceElement.draggable){
                        draggedPiece = pieceElement;
                        sourceSquare = {row: rowIndex, col: squareIndex};
                        e.dataTransfer.setData('text/plain', '');
                    }
                });

                pieceElement.addEventListener('dragend', (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);

            }

            squareElement.addEventListener('dragover', function (e) {
                e.preventDefault();
            });

            squareElement.addEventListener('drop', function (e) {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSource = { row: parseInt(squareElement.dataset.row), col: parseInt(squareElement.dataset.col) };
                    
                    handleMove(sourceSquare, targetSource);

                }
            });
            boardElement.appendChild(squareElement);
        });
        
    })

    if(playerRole==='b'){
        boardElement.classList.add('flipped');
    }else{
        boardElement.classList.remove('flipped');
    }
}

const handleMove = (source,target) => {
    const move={
        from:`${String.fromCharCode(97+source.col)}${8-source.row}`,
        to:`${String.fromCharCode(97+target.col)}${8-target.row}`,
        promotion: 'q' // default to queen promotion
    }
    socket.emit('move', move);
}

const getPieceUnicode = (piece) => {
    const pieceUnicode = {
        p: '♙', // Pawn
        r: '♜', // Rook
        n: '♞', // Knight
        b: '♝', // Bishop
        q: '♛', // Queen
        k: '♚', // King
    };

    return pieceUnicode[piece.type] || '';
}

const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

socket.on('playerRole', function(role) {
    playerRole = role;  
    renderBoard();
});

socket.on('spectatorRole', function(role) {
    playerRole = null;  
    renderBoard();
});

socket.on('boardState', function(fen) {
    chess.load(fen); 
    renderBoard();
});

socket.on('move', function(move) {
    chess.move(move); 
    renderBoard();
});

socket.on('invalidMove', (data) => {
    messageElement.innerText = `Illegal Move: ${data.move.from}-${data.move.to}`;
    // Clear the message after 3 seconds
    setTimeout(() => {
        messageElement.innerText = '';
    }, 3000);
});

socket.on('timerUpdate', (timers) => {
    whiteTimerEl.innerText = formatTime(timers.w);
    blackTimerEl.innerText = formatTime(timers.b);
});

socket.on('gameOver', (data) => {
    isGameOver = true; // Set the flag to true
    messageElement.innerText = `Game Over! ${data.reason}. Winner: ${data.winner}`;
    // Re-render the board to make pieces non-draggable
    renderBoard();
});

socket.on('check', (data) => {
    const checkedPlayer = data.player === 'w' ? 'White' : 'Black';
    messageElement.innerText = `${checkedPlayer} is in Check!`;
    // Clear the message after a few seconds, but only if the game hasn't ended
    setTimeout(() => {
        if (!isGameOver) {
            messageElement.innerText = '';
        }
    }, 3000);
});

renderBoard();
