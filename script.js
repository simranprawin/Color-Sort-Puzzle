
const board = document.getElementById("tubeBoard");
const movesDisplay = document.getElementById("moves");
const bestDisplay = document.getElementById("bestMoves");
const levelDisplay = document.getElementById("level");
const colorCountDisplay = document.getElementById("colorCount");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const hint = document.getElementById("hint");

const undoBtn = document.getElementById("undoBtn");
const restartBtn = document.getElementById("restartBtn");
const newBtn = document.getElementById("newBtn");

const winModal = document.getElementById("winModal");
const finalMoves = document.getElementById("finalMoves");
const finalLevel = document.getElementById("finalLevel");
const continueBtn = document.getElementById("continueBtn");

const colors = [
    "#F28EAD",
    "#A995DC",
    "#82CDB6",
    "#FFBD8F",
    "#81B8E8",
    "#E9C56F"
];

const CAPACITY = 4;

let tubes = [];
let initialTubes = [];
let history = [];
let selectedTube = null;
let moves = 0;
let level = 1;
let colorTotal = 4;
let gameWon = false;
let isPouring = false;
let drag = null;

let bestScores = JSON.parse(
    localStorage.getItem("colorSortBest") || "{}"
);

function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

function createPuzzle() {
    const drops = [];

    colors.slice(0, colorTotal).forEach(color => {
        for (let i = 0; i < CAPACITY; i++) {
            drops.push(color);
        }
    });

    const mixed = shuffle(drops);

    tubes = [];

    for (let i = 0; i < colorTotal; i++) {
        tubes.push(mixed.slice(i * CAPACITY, (i + 1) * CAPACITY));
    }

    tubes.push([], []);

    initialTubes = tubes.map(tube => [...tube]);

    history = [];
    moves = 0;
    selectedTube = null;
    gameWon = false;
    isPouring = false;
    drag = null;

    winModal.classList.remove("show");

    hint.textContent = "✨ Drag a bottle onto another to pour!";

    updateStats();
    renderBoard();
}

function renderBoard() {
    board.innerHTML = "";

    tubes.forEach((tube, index) => {
        const element = document.createElement("button");

        element.type = "button";
        element.className = "tube";
        element.dataset.index = index;
        element.setAttribute(
            "aria-label",
            `Bottle ${index + 1}, ${tube.length} drops`
        );

        if (selectedTube === index) {
            element.classList.add("selected");
        }

        tube.forEach(color => {
            const liquid = document.createElement("div");
            liquid.className = "liquid";
            liquid.style.background = color;
            liquid.style.boxShadow = "inset 0 3px 4px #ffffff50";
            element.appendChild(liquid);
        });

        element.addEventListener("pointerdown", event => {
            beginDrag(event, index, element);
        });

        board.appendChild(element);
    });
}

// Start physically moving a bottle.
function beginDrag(event, index, element) {
    if (gameWon || isPouring || event.button !== 0) return;

    event.preventDefault();

    drag = {
        index,
        element,
        startX: event.clientX,
        startY: event.clientY,
        moved: false
    };

    element.setPointerCapture(event.pointerId);
    element.style.setProperty("--drag-x", "0px");
    element.style.setProperty("--drag-y", "0px");
}

// Follow the pointer while dragging.
document.addEventListener("pointermove", event => {
    if (!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        drag.moved = true;
    }

    if (drag.moved) {
        drag.element.classList.add("dragging");
        drag.element.style.setProperty("--drag-x", `${dx}px`);
        drag.element.style.setProperty("--drag-y", `${dy}px`);
    }
});

// Drop the bottle over another bottle.
document.addEventListener("pointerup", event => {
    if (!drag) return;

    const currentDrag = drag;
    drag = null;

    const { index, element, moved } = currentDrag;

    element.classList.remove("dragging");
    element.style.removeProperty("--drag-x");
    element.style.removeProperty("--drag-y");

    if (!moved) {
        selectTube(index);
        return;
    }

    const elements = document.elementsFromPoint(
        event.clientX,
        event.clientY
    );

    const targetElement = elements.find(item => {
        return item.classList.contains("tube") &&
            item !== element;
    });

    if (!targetElement) {
        hint.textContent = "🌸 Drop the bottle onto another bottle!";
        return;
    }

    const targetIndex = Number(targetElement.dataset.index);

    if (Number.isInteger(targetIndex)) {
        pourBetween(index, targetIndex, element, targetElement);
    }
});

document.addEventListener("pointercancel", () => {
    if (!drag) return;

    drag.element.classList.remove("dragging");
    drag.element.style.removeProperty("--drag-x");
    drag.element.style.removeProperty("--drag-y");
    drag = null;
});

// Tap-based selection also works.
function selectTube(index) {
    if (gameWon || isPouring) return;

    if (selectedTube === null) {
        if (tubes[index].length === 0) {
            hint.textContent = "🌸 Pick up a bottle containing color!";
            return;
        }

        selectedTube = index;
        hint.textContent = "✨ Now tap another bottle!";
        renderBoard();
        return;
    }

    if (selectedTube === index) {
        selectedTube = null;
        hint.textContent = "🌷 Choose a bottle to continue.";
        renderBoard();
        return;
    }

    const sourceElement = board.children[selectedTube];
    const targetElement = board.children[index];

    pourBetween(
        selectedTube,
        index,
        sourceElement,
        targetElement
    );
}

function canPour(sourceIndex, targetIndex) {
    const source = tubes[sourceIndex];
    const target = tubes[targetIndex];

    if (source.length === 0 || target.length >= CAPACITY) {
        return false;
    }

    const sourceColor = source[source.length - 1];
    const targetColor = target[target.length - 1];

    return (
        target.length === 0 ||
        targetColor === sourceColor
    );
}

function saveHistory() {
    history.push({
        tubes: tubes.map(tube => [...tube]),
        moves
    });
}

// Animate the bottle and transfer the liquid.
function pourBetween(sourceIndex, targetIndex, sourceElement, targetElement) {
    if (sourceIndex === targetIndex) return;

    if (!canPour(sourceIndex, targetIndex)) {
        selectedTube = null;
        hint.textContent = "💗 Pour only into an empty bottle or a matching color!";
        renderBoard();
        return;
    }

    const source = tubes[sourceIndex];
    const target = tubes[targetIndex];

    const topColor = source[source.length - 1];

    let amount = 0;

    for (let i = source.length - 1; i >= 0; i--) {
        if (source[i] === topColor) {
            amount++;
        } else {
            break;
        }
    }

    amount = Math.min(amount, CAPACITY - target.length);

    saveHistory();

    selectedTube = null;
    isPouring = true;

    sourceElement.classList.add("pouring");
    targetElement.classList.add("receiving");

    hint.textContent = "🧪 Pouring the colors...";

    setTimeout(() => {
        for (let i = 0; i < amount; i++) {
            target.push(source.pop());
        }

        moves++;
        isPouring = false;

        hint.textContent = "✨ Beautiful! Keep sorting!";

        updateStats();
        renderBoard();
        checkWin();
    }, 350);
}

function checkWin() {
    const completed = tubes.filter(tube =>
        tube.length === CAPACITY &&
        tube.every(color => color === tube[0])
    ).length;

    progressText.textContent = `${completed} / ${colorTotal}`;

    progressFill.style.width =
        `${completed / colorTotal * 100}%`;

    if (completed === colorTotal) {
        gameWon = true;
        showWin();
    }
}

function updateStats() {
    movesDisplay.textContent = moves;
    levelDisplay.textContent = String(level).padStart(2, "0");
    colorCountDisplay.textContent = colorTotal;

    bestDisplay.textContent = bestScores[level] || "--";

    undoBtn.disabled = history.length === 0;
    undoBtn.style.opacity = history.length === 0 ? "0.5" : "1";

    checkWinProgress();
}

function checkWinProgress() {
    const completed = tubes.filter(tube =>
        tube.length === CAPACITY &&
        tube.every(color => color === tube[0])
    ).length;

    progressText.textContent = `${completed} / ${colorTotal}`;
    progressFill.style.width =
        `${completed / colorTotal * 100}%`;
}

function undoMove() {
    if (!history.length || gameWon || isPouring) return;

    const previous = history.pop();

    tubes = previous.tubes.map(tube => [...tube]);
    moves = previous.moves;
    selectedTube = null;

    hint.textContent = "↶ Your last move has been undone!";

    updateStats();
    renderBoard();
}

function restartGame() {
    if (isPouring) return;

    tubes = initialTubes.map(tube => [...tube]);

    history = [];
    moves = 0;
    selectedTube = null;
    gameWon = false;

    winModal.classList.remove("show");

    hint.textContent = "🌸 Fresh start! Let's sort again.";

    updateStats();
    renderBoard();
}

function newGame() {
    if (isPouring) return;
    createPuzzle();
}

function showWin() {
    const oldBest = bestScores[level] || Infinity;

    if (moves < oldBest) {
        bestScores[level] = moves;

        localStorage.setItem(
            "colorSortBest",
            JSON.stringify(bestScores)
        );
    }

    finalMoves.textContent = moves;
    finalLevel.textContent = level;

    updateStats();

    hint.textContent = "🎉 Every color found its home!";
    winModal.classList.add("show");
}

function nextLevel() {
    if (!gameWon) return;

    level++;
    colorTotal = Math.min(6, 4 + Math.floor((level - 1) / 2));

    createPuzzle();
}

undoBtn.addEventListener("click", undoMove);
restartBtn.addEventListener("click", restartGame);
newBtn.addEventListener("click", newGame);
continueBtn.addEventListener("click", nextLevel);

createPuzzle();
