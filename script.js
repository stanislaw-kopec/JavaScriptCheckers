// Każde miejsce w tablicy odpowiada jednemu polu planszy, od 0 do 63.
function createInitialBoard() {
    const board = [
        null, 0, null, 1, null, 2, null, 3,
        4, null, 5, null, 6, null, 7, null,
        null, 8, null, 9, null, 10, null, 11,
        null, null, null, null, null, null, null, null,
        null, null, null, null, null, null, null, null,
        12, null, 13, null, 14, null, 15, null,
        null, 16, null, 17, null, 18, null, 19,
        20, null, 21, null, 22, null, 23, null,
    ];

    // Zamieniamy numery pionków na obiekty opisujące ich właściwości.
    for (let index = 0; index < board.length; index++) {
        const pieceId = board[index];

        if (pieceId !== null) {
            let color = "gold";

            if (pieceId < 12) {
                color = "black";
            }

            board[index] = {
                id: pieceId,
                color: color,
                isKing: false
            };
        }
    }

    return board;
}

// Stan gry: wszystkie informacje o bieżącej rozgrywce w jednym miejscu.
const gameState = {
    board: createInitialBoard(),
    currentPlayer: "gold",
    selectedPieceIndex: null
};

// Ta funkcja zmienia wyłącznie dane gry. Nie korzysta z elementów HTML.
function selectPiece(boardIndex) {
    const piece = gameState.board[boardIndex];

    if (!piece || piece.color !== gameState.currentPlayer) {
        return;
    }

    gameState.selectedPieceIndex = boardIndex;
}

// Zwracamy numery pustych pól, na które pionek może wykonać zwykły ruch.
function getAvailableMoves(boardIndex) {
    const piece = gameState.board[boardIndex];

    if (!piece || piece.color !== gameState.currentPlayer) {
        return [];
    }

    const row = Math.floor(boardIndex / 8);
    const column = boardIndex % 8;
    let direction = 1;

    if (piece.color === "gold") {
        direction = -1;
    }

    const nextRow = row + direction;
    const moves = [];

    // Sprawdzamy przekątną w lewo, a następnie w prawo.
    for (const columnOffset of [-1, 1]) {
        const nextColumn = column + columnOffset;

        if (nextRow >= 0 && nextRow < 8 && nextColumn >= 0 && nextColumn < 8) {
            const targetIndex = nextRow * 8 + nextColumn;

            if (gameState.board[targetIndex] === null) {
                moves.push(targetIndex);
            }
        }
    }

    return moves;
}

function makeMove(targetIndex) {
    const sourceIndex = gameState.selectedPieceIndex;
    const availableMoves = getAvailableMoves(sourceIndex);

    // Odrzucony ruch nie zmienia planszy, zaznaczenia ani tury.
    if (!availableMoves.includes(targetIndex)) {
        return false;
    }

    gameState.board[targetIndex] = gameState.board[sourceIndex];
    gameState.board[sourceIndex] = null;
    gameState.selectedPieceIndex = null;

    if (gameState.currentPlayer === "gold") {
        gameState.currentPlayer = "black";
    } else {
        gameState.currentPlayer = "gold";
    }

    return true;
}

const cells = document.querySelectorAll(".field td");
const goldPlayer = document.querySelector(".gamer2");
const blackPlayer = document.querySelector(".gamer1");
const turnStatus = document.querySelector(".turn-status");

// Odtwarzamy pionki i zaznaczenie na podstawie danych zapisanych w gameState.
function renderBoard() {
    const availableMoves = getAvailableMoves(gameState.selectedPieceIndex);

    for (let index = 0; index < gameState.board.length; index++) {
        const cell = cells[index];
        const piece = gameState.board[index];
        cell.textContent = "";
        cell.classList.toggle("available-move", availableMoves.includes(index));

        if (piece !== null) {
            const pieceElement = document.createElement("p");
            pieceElement.id = String(piece.id);
            pieceElement.className = piece.color + "-piece";

            if (gameState.selectedPieceIndex === index) {
                pieceElement.classList.add("selected-piece");
            }

            cell.appendChild(pieceElement);
        }
    }

    renderTurn();
}

function renderTurn() {
    goldPlayer.classList.toggle("active-turn", gameState.currentPlayer === "gold");
    blackPlayer.classList.toggle("active-turn", gameState.currentPlayer === "black");

    let message = "Tura: czarne pionki";

    if (gameState.currentPlayer === "gold") {
        message = "Tura: złote pionki";
    }

    if (turnStatus.textContent !== message) {
        turnStatus.textContent = message;
    }
}

function handleCellClick(event) {
    const boardIndex = Number(event.currentTarget.dataset.index);

    if (gameState.board[boardIndex] === null) {
        makeMove(boardIndex);
    } else {
        selectPiece(boardIndex);
    }

    renderBoard();
}

function giveCellsEventListeners() {
    for (let index = 0; index < cells.length; index++) {
        // data-index łączy pole HTML z jego miejscem w tablicy planszy.
        cells[index].dataset.index = index;
        cells[index].addEventListener("click", handleCellClick);
    }
}

// Pola pozostają na stronie, więc ich obsługa kliknięć przetrwa odtworzenie pionków.
giveCellsEventListeners();
renderBoard();
