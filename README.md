# JavaScript Checkers

A local two-player checkers game built with plain HTML, CSS, and JavaScript. Originally started as a school project in 2021, it has been revisited to finish the gameplay while keeping its original gold-and-black design.

## Features

- Two players sharing one computer
- Highlighted legal moves and turn indicators
- Mandatory captures and multi-capture sequences
- King promotion and long-range king moves
- Win detection and a new game button

## Play locally

Download or clone this repository, then open `index.html` in your browser. Keep `index.html`, `style.css`, and `script.js` in the same folder. No installation or build step is needed.

Gold moves first. Click one of your pieces, then a highlighted destination. Use **Nowa gra** (New game) to restart. The game interface is in Polish.

## Rules

The game uses an 8 × 8 board with 12 pieces per player. Regular pieces move forward and capture in both directions. Captures are mandatory: choose a sequence that captures the most pieces and complete it with the same piece. Captured pieces remain blockers until the sequence ends.

A piece becomes a king when it finishes its entire move on the opponent's back rank. Kings move and capture along diagonals over longer distances. A player loses when they have no pieces or no legal moves.

## Tests

With Node.js installed, run:

```sh
node --test tests/movement.test.cjs
```

Tests cover movement, captures, kings, game outcomes, and restarting a match. They simulate the page rather than running a real browser.

## Limitations

Designed for desktop mouse controls. There is no online multiplayer, computer opponent, saved progress, or automatic draw detection. Refreshing the page starts a new game.
