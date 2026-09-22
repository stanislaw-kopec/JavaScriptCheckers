// Uruchomienie: node --test tests/movement.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// Mała symulacja elementów strony pozwala sprawdzić dane oraz obsługę kliknięć.
// Nie zastępuje sprawdzenia wyglądu w prawdziwej przeglądarce.
class PageElement {
    constructor() {
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.classes = new Set();
        this.listeners = new Map();
        this.text = "";
        this.classList = {
            add: name => this.classes.add(name),
            contains: name => this.classes.has(name),
            toggle: (name, enabled) => {
                if (enabled) this.classes.add(name);
                else this.classes.delete(name);
            }
        };
    }

    set className(value) { this.classes = new Set(value.split(" ")); }
    set textContent(value) {
        this.children.forEach(child => { child.parentElement = null; });
        this.children = [];
        this.text = value;
    }
    get textContent() { return this.text; }
    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
    }
    addEventListener(name, callback) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name).add(callback);
    }
    click() {
        for (let element = this; element; element = element.parentElement) {
            for (const callback of element.listeners.get("click") || []) {
                callback({ target: this, currentTarget: element });
            }
        }
    }
}

function createGame() {
    const cells = Array.from(html.matchAll(/<td class="([^"]+)"/g), ([, name]) => {
        const cell = new PageElement();
        cell.className = name;
        return cell;
    });
    const labels = {
        ".gamer1": new PageElement(),
        ".gamer2": new PageElement(),
        ".turn-status": new PageElement()
    };
    const document = {
        querySelectorAll(selector) {
            assert.equal(selector, ".field td");
            return cells;
        },
        querySelector(selector) {
            assert.ok(labels[selector], `Unexpected selector: ${selector}`);
            return labels[selector];
        },
        createElement() { return new PageElement(); }
    };
    const context = vm.createContext({ document });
    vm.runInContext(script, context);
    const run = code => vm.runInContext(code, context);
    return {
        cells,
        labels,
        run,
        state: () => JSON.parse(run("JSON.stringify(gameState)")),
        highlights: () => cells.flatMap((cell, index) =>
            cell.classList.contains("available-move") ? [index] : [])
    };
}

function setPosition(game, currentPlayer, pieces) {
    const board = Array(64).fill(null);
    for (const [index, color] of pieces) {
        board[index] = { id: index, color: color, isKing: false };
    }
    game.run(`gameState.board = ${JSON.stringify(board)};
        gameState.currentPlayer = ${JSON.stringify(currentPlayer)};
        gameState.selectedPieceIndex = null;
        gameState.forcedPieceIndex = null;
        gameState.capturedIndices = [];
        renderBoard();`);
}

test("gold starts with 24 pieces and no selected destination", () => {
    const game = createGame();
    assert.equal(game.cells.length, 64);
    assert.equal(game.state().board.filter(Boolean).length, 24);
    assert.equal(game.state().currentPlayer, "gold");
    assert.equal(game.state().selectedPieceIndex, null);
    assert.deepEqual(game.highlights(), []);
    assert.equal(game.labels[".turn-status"].textContent, "Tura: złote pionki");
    assert.equal(game.labels[".gamer2"].classList.contains("active-turn"), true);
    assert.equal(game.labels[".gamer1"].classList.contains("active-turn"), false);
});

test("selection highlights only empty forward diagonals and replaces old hints", () => {
    const game = createGame();
    game.cells[40].children[0].click();
    assert.deepEqual(game.highlights(), [33]);
    game.cells[42].children[0].click();
    assert.deepEqual(game.highlights(), [33, 35]);
    game.cells[1].children[0].click();
    assert.equal(game.state().selectedPieceIndex, 42);
    assert.deepEqual(game.highlights(), [33, 35]);
    game.cells[56].children[0].click();
    assert.deepEqual(game.highlights(), []);
    assert.equal(game.state().currentPlayer, "gold");
});

for (const [color, source, expected] of [
    ["gold", 40, [33]],
    ["gold", 39, [30]],
    ["black", 24, [33]],
    ["black", 23, [30]],
    ["gold", 1, []],
    ["black", 62, []],
    ["gold", 26, [17, 19]],
    ["black", 26, [33, 35]]
]) {
    test(`${color} at ${source} stays on the board and moves only forward`, () => {
        const game = createGame();
        game.run(`gameState.board.fill(null);
            gameState.currentPlayer = "${color}";
            gameState.board[${source}] = { id: 0, color: "${color}", isKing: false };`);
        const moves = JSON.parse(game.run(`JSON.stringify(getAvailableMoves(${source}))`));
        assert.deepEqual(moves, expected);
        for (const target of moves) {
            assert.equal(game.cells[target].classList.contains("cell"), true);
        }
    });
}

for (const blockerColor of ["gold", "black"]) {
    test(`a ${blockerColor} piece cannot be landed on or jumped over to an occupied field`, () => {
        const game = createGame();
        game.run(`gameState.board[33] = { id: 99, color: "${blockerColor}", isKing: false };
            gameState.board[26] = { id: 98, color: "gold", isKing: false };
            selectPiece(40);`);
        const before = game.state();
        assert.equal(game.run("getAvailableMoves(40).length"), 0);
        assert.equal(game.run("makeMove(33)"), false);
        assert.equal(game.run("makeMove(26)"), false);
        assert.deepEqual(game.state(), before);
    });
}

test("invalid destinations preserve the board, selected piece and turn", () => {
    const game = createGame();
    game.run("selectPiece(40)");
    const before = game.state();
    for (const destination of ["-1", "64", "26", "49", "41", "32", "40", "null", "NaN", "33.5"]) {
        assert.equal(game.run(`makeMove(${destination})`), false, destination);
        assert.deepEqual(game.state(), before);
    }
    game.cells[32].click();
    assert.deepEqual(game.state(), before);
    assert.deepEqual(game.highlights(), [33]);
});

test("a move requires a selected piece belonging to the current player", () => {
    const game = createGame();
    const before = game.state();
    game.cells[33].click();
    assert.deepEqual(game.state(), before);
    game.run("selectPiece(40); gameState.currentPlayer = 'black';");
    const staleSelection = game.state();
    assert.equal(game.run("makeMove(33)"), false);
    assert.deepEqual(game.state(), staleSelection);
});

test("a legal move preserves the piece and clears the origin and selection", () => {
    const game = createGame();
    game.run("const movingPiece = gameState.board[40]; selectPiece(40);");
    assert.equal(game.run("makeMove(33)"), true);
    assert.equal(game.run("gameState.board[33] === movingPiece"), true);
    assert.equal(game.state().board[40], null);
    assert.equal(game.state().selectedPieceIndex, null);
    assert.equal(game.state().currentPlayer, "black");
    assert.equal(game.state().board.filter(Boolean).length, 24);
});

test("successive clicks move both colors, update turns and clear old hints", () => {
    const game = createGame();
    // Te ruchy nie tworzą obowiązku bicia; bicia sprawdzamy w osobnych scenariuszach.
    for (const [source, target] of [[40, 33], [17, 24], [44, 37]]) {
        const piece = game.state().board[source];
        game.cells[source].children[0].click();
        assert.ok(game.highlights().includes(target));
        game.cells[target].click();
        const state = game.state();
        assert.deepEqual(state.board[target], piece);
        assert.equal(state.board[source], null);
        assert.equal(state.selectedPieceIndex, null);
        assert.equal(game.cells[source].children.length, 0);
        assert.equal(game.cells[target].children[0].id, String(piece.id));
        assert.equal(game.cells[target].children[0].classList.contains(piece.color + "-piece"), true);
        assert.equal(game.cells[target].children[0].classList.contains("selected-piece"), false);
        assert.deepEqual(game.highlights(), []);
        assert.equal(state.currentPlayer, piece.color === "gold" ? "black" : "gold");
        assert.equal(game.labels[".gamer2"].classList.contains("active-turn"), state.currentPlayer === "gold");
        assert.equal(game.labels[".gamer1"].classList.contains("active-turn"), state.currentPlayer === "black");
        assert.equal(game.labels[".turn-status"].textContent,
            state.currentPlayer === "gold" ? "Tura: złote pionki" : "Tura: czarne pionki");
        assert.equal(state.board.filter(Boolean).length, 24);
        assert.equal(new Set(state.board.filter(Boolean).map(item => item.id)).size, 24);
        game.cells[target].children[0].click();
        assert.equal(game.state().selectedPieceIndex, null);
    }
});

for (const color of ["gold", "black"]) {
    for (const [jumped, target] of [[17, 8], [19, 12], [33, 40], [35, 44]]) {
        test(`${color} captures from 26 over ${jumped} to ${target}`, () => {
            const game = createGame();
            const opponent = color === "gold" ? "black" : "gold";
            setPosition(game, color, [[26, color], [jumped, opponent]]);
            game.cells[26].children[0].click();
            assert.deepEqual(game.highlights(), [target]);
            assert.equal(game.run("hasMandatoryCapture()"), true);
            game.cells[target].click();
            const state = game.state();
            assert.equal(state.board[26], null);
            assert.equal(state.board[jumped], null);
            assert.deepEqual(state.board[target], { id: 26, color: color, isKing: false });
            assert.equal(state.board.filter(Boolean).length, 1);
            assert.equal(state.currentPlayer, opponent);
            assert.equal(state.selectedPieceIndex, null);
            assert.equal(game.cells[jumped].children.length, 0);
            assert.equal(game.cells[target].children[0].id, "26");
            assert.deepEqual(game.highlights(), []);
        });
    }
}

for (const [source, jumped] of [[1, 8], [14, 23], [49, 56], [62, 55]]) {
    test(`capture from ${source} over ${jumped} cannot wrap across the board edge`, () => {
        const game = createGame();
        setPosition(game, "gold", [[source, "gold"], [jumped, "black"]]);
        assert.equal(game.run(`getCaptures(${source}).length`), 0);
        assert.equal(game.run("hasMandatoryCapture()"), false);
    });
}

for (const color of ["gold", "black"]) {
    test(`a capture cannot land on an occupied ${color} piece`, () => {
        const game = createGame();
        setPosition(game, "gold", [[26, "gold"], [17, "black"], [8, color]]);
        game.run("selectPiece(26)");
        const before = game.state();
        assert.equal(game.run("getCaptures(26).length"), 0);
        assert.equal(game.run("makeMove(8)"), false);
        assert.deepEqual(game.state(), before);
    });
}

test("a piece cannot jump over an empty field or its own piece", () => {
    const game = createGame();
    for (const pieces of [[[26, "gold"]], [[26, "gold"], [17, "gold"]]]) {
        setPosition(game, "gold", pieces);
        game.run("selectPiece(26)");
        const before = game.state();
        assert.equal(game.run("getCaptures(26).length"), 0);
        assert.equal(game.run("makeMove(8)"), false);
        assert.deepEqual(game.state(), before);
    }
});

test("mandatory capture blocks quiet moves and selection of non-capturing teammates", () => {
    const game = createGame();
    setPosition(game, "gold", [[42, "gold"], [33, "black"], [46, "gold"]]);
    assert.equal(game.labels[".turn-status"].textContent, "Tura: złote pionki — obowiązkowe bicie.");
    game.cells[46].children[0].click();
    assert.equal(game.state().selectedPieceIndex, null);
    assert.equal(game.run("getAvailableMoves(46).length"), 0);
    game.cells[42].children[0].click();
    assert.deepEqual(game.highlights(), [24]);
    const before = game.state();
    game.cells[35].click();
    assert.deepEqual(game.state(), before);
    game.cells[46].children[0].click();
    assert.deepEqual(game.state(), before);
    // Walidacja ruchu działa także niezależnie od obsługi kliknięć.
    game.run("gameState.selectedPieceIndex = 46");
    const forcedSelection = game.state();
    assert.equal(game.run("makeMove(37)"), false);
    assert.deepEqual(game.state(), forcedSelection);
});

test("an available capture belonging only to the opponent does not block a quiet move", () => {
    const game = createGame();
    setPosition(game, "gold", [[35, "gold"], [26, "black"], [17, "black"]]);
    assert.equal(game.run("getCaptures(26).length"), 1);
    assert.equal(game.run("hasMandatoryCapture()"), false);
    game.cells[35].children[0].click();
    assert.deepEqual(game.highlights(), [28]);
    game.cells[28].click();
    assert.equal(game.state().board[28].color, "gold");
    assert.equal(game.state().board.filter(Boolean).length, 3);
});

test("all four capture choices are offered and only the chosen opponent is removed", () => {
    const game = createGame();
    setPosition(game, "gold", [[26, "gold"], [17, "black"], [19, "black"], [33, "black"], [35, "black"]]);
    // Numer 0 i status damki przeciwnika nie mogą uniemożliwić jego zbicia.
    game.run("gameState.board[35].id = 0; gameState.board[35].isKing = true; renderBoard();");
    game.cells[26].children[0].click();
    assert.deepEqual(game.highlights(), [8, 12, 40, 44]);
    game.cells[44].click();
    const state = game.state();
    assert.equal(state.board[35], null);
    assert.equal(state.board[44].id, 26);
    for (const index of [17, 19, 33]) assert.equal(state.board[index].id, index);
    assert.equal(state.board.filter(Boolean).length, 4);
});

test("the opening example produces a mandatory capture and updates the next player's notice", () => {
    const game = createGame();
    for (const [source, target] of [[40, 33], [19, 26]]) {
        game.cells[source].children[0].click();
        assert.ok(game.highlights().includes(target));
        game.cells[target].click();
    }
    assert.equal(game.labels[".turn-status"].textContent, "Tura: złote pionki — obowiązkowe bicie.");
    game.cells[42].children[0].click();
    assert.equal(game.state().selectedPieceIndex, null);
    game.cells[33].children[0].click();
    assert.deepEqual(game.highlights(), [19]);
    game.cells[19].click();
    assert.equal(game.state().board[19].id, 12);
    assert.equal(game.state().board[26], null);
    assert.equal(game.state().board[33], null);
    assert.equal(game.state().board.filter(Boolean).length, 23);
    assert.equal(game.state().currentPlayer, "black");
    assert.equal(game.labels[".turn-status"].textContent, "Tura: czarne pionki — obowiązkowe bicie.");
    assert.equal(game.labels[".gamer1"].classList.contains("active-turn"), true);
});

for (const color of ["gold", "black"]) {
    test(`${color} must finish a two-capture sequence with the same piece`, () => {
        const game = createGame();
        const opponent = color === "gold" ? "black" : "gold";
        setPosition(game, color, [[42, color], [33, opponent], [17, opponent], [46, color], [37, opponent]]);
        game.cells[42].children[0].click();
        game.cells[24].click();
        const afterFirstJump = game.state();
        assert.equal(afterFirstJump.currentPlayer, color);
        assert.equal(afterFirstJump.forcedPieceIndex, 24);
        assert.equal(afterFirstJump.selectedPieceIndex, 24);
        assert.deepEqual(afterFirstJump.capturedIndices, [33]);
        assert.equal(afterFirstJump.board.filter(Boolean).length, 5);
        assert.equal(game.cells[33].children[0].classList.contains("captured-piece"), true);
        assert.equal(game.cells[24].children[0].classList.contains("selected-piece"), true);
        assert.deepEqual(game.highlights(), [10]);
        assert.match(game.labels[".turn-status"].textContent, /kontynuuj bicie tym samym pionkiem/);
        // Nie wolno zmienić pionka ani zbić drugi raz tego samego przeciwnika.
        game.cells[46].children[0].click();
        game.cells[33].children[0].click();
        game.cells[42].click();
        game.cells[26].click();
        assert.deepEqual(game.state(), afterFirstJump);
        assert.equal(game.run("getAvailableMoves(46).length"), 0);
        game.run("gameState.selectedPieceIndex = 46");
        const invalidSelection = game.state();
        assert.equal(game.run("makeMove(28)"), false);
        assert.deepEqual(game.state(), invalidSelection);
        game.cells[24].children[0].click();
        game.cells[10].click();
        const finished = game.state();
        assert.equal(finished.board[10].id, 42);
        assert.equal(finished.board[33], null);
        assert.equal(finished.board[17], null);
        assert.equal(finished.board[24], null);
        assert.equal(finished.board.filter(Boolean).length, 3);
        assert.equal(finished.currentPlayer, opponent);
        assert.equal(finished.forcedPieceIndex, null);
        assert.equal(finished.selectedPieceIndex, null);
        assert.deepEqual(finished.capturedIndices, []);
        assert.deepEqual(game.highlights(), []);
        assert.equal(game.cells[33].children.length, 0);
        assert.equal(game.cells[17].children.length, 0);
    });
}

test("a shorter capture branch is rejected even when it captures a king", () => {
    const game = createGame();
    setPosition(game, "gold", [[42, "gold"], [33, "black"], [35, "black"], [19, "black"]]);
    game.run("gameState.board[33].isKing = true; renderBoard();");
    assert.equal(game.run("getRequiredCaptureCount()"), 2);
    game.cells[42].children[0].click();
    assert.deepEqual(game.highlights(), [28]);
    const before = game.state();
    assert.equal(game.run("makeMove(24)"), false);
    assert.deepEqual(game.state(), before);
    game.cells[28].click();
    assert.deepEqual(game.highlights(), [10]);
    game.cells[10].click();
    assert.equal(game.state().board[33].isKing, true);
    assert.equal(game.state().board[35], null);
    assert.equal(game.state().board[19], null);
    assert.equal(game.state().currentPlayer, "black");
});

test("the maximum capture count is compared across all friendly pieces", () => {
    const game = createGame();
    setPosition(game, "gold", [[42, "gold"], [33, "black"], [17, "black"], [46, "gold"], [37, "black"]]);
    assert.equal(game.run("getCaptures(46).length"), 1);
    assert.equal(game.run("getAvailableMoves(46).length"), 0);
    game.cells[46].children[0].click();
    assert.equal(game.state().selectedPieceIndex, null);
    game.cells[42].children[0].click();
    assert.deepEqual(game.highlights(), [24]);
    game.cells[46].children[0].click();
    assert.equal(game.state().selectedPieceIndex, 42);
});

test("equally long captures by different pieces can both be selected before the first jump", () => {
    const game = createGame();
    setPosition(game, "gold", [[8, "gold"], [12, "gold"], [17, "black"], [21, "black"]]);
    game.cells[8].children[0].click();
    assert.deepEqual(game.highlights(), [26]);
    game.cells[12].children[0].click();
    assert.equal(game.state().selectedPieceIndex, 12);
    assert.deepEqual(game.highlights(), [30]);
});

test("the longest continuation remains mandatory after a shared first jump", () => {
    const game = createGame();
    setPosition(game, "gold", [[49, "gold"], [42, "black"], [26, "black"], [28, "black"], [10, "black"]]);
    assert.equal(game.run("getRequiredCaptureCount()"), 3);
    game.cells[49].children[0].click();
    assert.deepEqual(game.highlights(), [35]);
    game.cells[35].click();
    assert.equal(game.run("getCaptures(35).length"), 2);
    assert.deepEqual(game.highlights(), [17]);
    const before = game.state();
    game.cells[21].click();
    assert.deepEqual(game.state(), before);
    game.cells[17].click();
    assert.deepEqual(game.highlights(), [3]);
    game.cells[3].click();
    assert.equal(game.state().board[3].id, 49);
    assert.equal(game.state().board[28].id, 28);
    assert.equal(game.state().board.filter(Boolean).length, 2);
    assert.equal(game.state().currentPlayer, "black");
});

test("equal longest branches allow a four-capture circuit ending on the starting field", () => {
    const game = createGame();
    setPosition(game, "gold", [[42, "gold"], [33, "black"], [17, "black"], [19, "black"], [35, "black"]]);
    game.cells[42].children[0].click();
    assert.equal(game.run("getRequiredCaptureCount()"), 4);
    assert.deepEqual(game.highlights(), [24, 28]);
    for (const [target, count] of [[24, 1], [10, 2], [28, 3]]) {
        game.cells[target].click();
        assert.equal(game.state().currentPlayer, "gold");
        assert.equal(game.state().forcedPieceIndex, target);
        assert.equal(game.state().capturedIndices.length, count);
        assert.equal(new Set(game.state().capturedIndices).size, count);
    }
    assert.deepEqual(game.highlights(), [42]);
    game.cells[42].click();
    assert.equal(game.state().board[42].id, 42);
    assert.equal(game.state().board.filter(Boolean).length, 1);
    assert.equal(game.state().currentPlayer, "black");
    assert.deepEqual(game.state().capturedIndices, []);
});

test("looking ahead never mutates the real board or the pending capture list", () => {
    const game = createGame();
    setPosition(game, "gold", [[42, "gold"], [33, "black"], [17, "black"], [19, "black"], [35, "black"]]);
    game.run("const originalBoard = gameState.board; const originalPiece = gameState.board[42];");
    const before = game.state();
    game.run("getCaptureOptions(42); getRequiredCaptureCount(); getAvailableMoves(42);");
    assert.deepEqual(game.state(), before);
    assert.equal(game.run("gameState.board === originalBoard && gameState.board[42] === originalPiece"), true);
    game.cells[42].children[0].click();
    game.cells[24].click();
    const duringSequence = game.state();
    game.run("getCaptureOptions(24); getRequiredCaptureCount(); renderBoard();");
    assert.deepEqual(game.state(), duringSequence);
});

test("a quiet move still ends the turn even when it creates a future capture", () => {
    const game = createGame();
    setPosition(game, "gold", [[40, "gold"], [26, "black"]]);
    game.cells[40].children[0].click();
    game.cells[33].click();
    assert.equal(game.run("getCaptures(33).length"), 1);
    assert.equal(game.state().currentPlayer, "black");
    assert.equal(game.state().forcedPieceIndex, null);
    assert.equal(game.state().selectedPieceIndex, null);
    assert.deepEqual(game.state().capturedIndices, []);
});
