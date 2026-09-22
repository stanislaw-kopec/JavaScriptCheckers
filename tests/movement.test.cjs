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
    test(`a ${blockerColor} piece blocks the destination without being captured`, () => {
        const game = createGame();
        game.run(`gameState.board[33] = { id: 99, color: "${blockerColor}", isKing: false };
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
    for (const [source, target] of [[40, 33], [17, 24], [42, 35], [19, 26], [49, 40], [10, 17]]) {
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
