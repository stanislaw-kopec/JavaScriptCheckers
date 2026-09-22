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
    selectedPieceIndex: null,
    forcedPieceIndex: null,
    capturedIndices: []
};

// Ta funkcja zmienia wyłącznie dane gry. Nie korzysta z elementów HTML.
function selectPiece(boardIndex) {
    const piece = gameState.board[boardIndex];

    if (!piece || piece.color !== gameState.currentPlayer) {
        return;
    }

    if (gameState.forcedPieceIndex !== null && boardIndex !== gameState.forcedPieceIndex) {
        return;
    }

    if (hasMandatoryCapture() && getAvailableMoves(boardIndex).length === 0) {
        return;
    }

    gameState.selectedPieceIndex = boardIndex;
}

// Każde bicie opisuje pole docelowe i pole zajęte przez zbijany pionek.
function getCaptures(boardIndex, board = gameState.board, capturedIndices = gameState.capturedIndices) {
    const piece = board[boardIndex];

    if (!piece) {
        return [];
    }

    const row = Math.floor(boardIndex / 8);
    const column = boardIndex % 8;
    const captures = [];

    // Obie pętle razem sprawdzają cztery przekątne, także do tyłu.
    for (const rowOffset of [-1, 1]) {
        for (const columnOffset of [-1, 1]) {
            const targetRow = row + 2 * rowOffset;
            const targetColumn = column + 2 * columnOffset;

            if (targetRow >= 0 && targetRow < 8 && targetColumn >= 0 && targetColumn < 8) {
                const capturedIndex = (row + rowOffset) * 8 + column + columnOffset;
                const targetIndex = targetRow * 8 + targetColumn;
                const jumpedPiece = board[capturedIndex];

                if (jumpedPiece && jumpedPiece.color !== piece.color && board[targetIndex] === null
                    && !capturedIndices.includes(capturedIndex)) {
                    captures.push({ targetIndex: targetIndex, capturedIndex: capturedIndex });
                }
            }
        }
    }

    return captures;
}

// Sprawdzamy możliwą przyszłość na kopiach planszy, bez zmiany rzeczywistej gry.
function getCaptureOptions(boardIndex, board = gameState.board, capturedIndices = gameState.capturedIndices) {
    const options = [];

    for (const capture of getCaptures(boardIndex, board, capturedIndices)) {
        const nextBoard = board.slice();
        nextBoard[capture.targetIndex] = nextBoard[boardIndex];
        nextBoard[boardIndex] = null;
        const nextCapturedIndices = capturedIndices.concat(capture.capturedIndex);
        let remainingCaptures = 0;

        // Rekurencja: ta sama funkcja sprawdza kolejne bicie po rozpatrywanym skoku.
        for (const nextOption of getCaptureOptions(capture.targetIndex, nextBoard, nextCapturedIndices)) {
            remainingCaptures = Math.max(remainingCaptures, nextOption.captureCount);
        }

        options.push({
            targetIndex: capture.targetIndex,
            capturedIndex: capture.capturedIndex,
            captureCount: 1 + remainingCaptures
        });
    }

    return options;
}

function getRequiredCaptureCount() {
    let maximum = 0;

    for (let index = 0; index < gameState.board.length; index++) {
        const piece = gameState.board[index];

        if (!piece || piece.color !== gameState.currentPlayer) {
            continue;
        }

        if (gameState.forcedPieceIndex !== null && index !== gameState.forcedPieceIndex) {
            continue;
        }

        for (const option of getCaptureOptions(index)) {
            maximum = Math.max(maximum, option.captureCount);
        }
    }

    return maximum;
}

// Wystarczy jedno dostępne bicie dowolnym pionkiem aktualnego gracza.
function hasMandatoryCapture() {
    if (gameState.forcedPieceIndex !== null) {
        return getCaptures(gameState.forcedPieceIndex).length > 0;
    }

    for (let index = 0; index < gameState.board.length; index++) {
        const piece = gameState.board[index];

        if (piece && piece.color === gameState.currentPlayer && getCaptures(index).length > 0) {
            return true;
        }
    }

    return false;
}

// Zwracamy pola dozwolonych bić albo — gdy żaden pionek nie może bić — zwykłych ruchów.
function getAvailableMoves(boardIndex) {
    const piece = gameState.board[boardIndex];

    if (!piece || piece.color !== gameState.currentPlayer) {
        return [];
    }

    if (gameState.forcedPieceIndex !== null && boardIndex !== gameState.forcedPieceIndex) {
        return [];
    }

    const requiredCaptures = getRequiredCaptureCount();

    if (requiredCaptures > 0 || gameState.forcedPieceIndex !== null) {
        const moves = [];

        for (const capture of getCaptureOptions(boardIndex)) {
            if (capture.captureCount === requiredCaptures) {
                moves.push(capture.targetIndex);
            }
        }

        return moves;
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

    let capturedIndex = null;

    for (const capture of getCaptures(sourceIndex)) {
        if (capture.targetIndex === targetIndex) {
            capturedIndex = capture.capturedIndex;
        }
    }

    gameState.board[targetIndex] = gameState.board[sourceIndex];
    gameState.board[sourceIndex] = null;

    if (capturedIndex !== null) {
        // Zbity pionek pozostaje przeszkodą do zakończenia całej serii.
        gameState.capturedIndices.push(capturedIndex);

        if (getCaptures(targetIndex).length > 0) {
            gameState.forcedPieceIndex = targetIndex;
            gameState.selectedPieceIndex = targetIndex;
            return true;
        }
    }

    // Dopiero po ostatnim skoku usuwamy zbite pionki i przekazujemy turę.
    for (const index of gameState.capturedIndices) {
        gameState.board[index] = null;
    }
    gameState.capturedIndices = [];
    gameState.forcedPieceIndex = null;
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

            if (gameState.capturedIndices.includes(index)) {
                pieceElement.classList.add("captured-piece");
            }

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

    if (gameState.forcedPieceIndex !== null) {
        message += " — kontynuuj bicie tym samym pionkiem.";
    } else if (hasMandatoryCapture()) {
        message += " — obowiązkowe bicie.";
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
