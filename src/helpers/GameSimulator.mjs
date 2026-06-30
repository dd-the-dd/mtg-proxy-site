function selected(card) {
    return card.selectedOption ?? card;
}

function cardName(card) {
    return card.name ?? selected(card).name ?? 'unknown card';
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function manaCostOf(card) {
    return selected(card).manaCost ?? '';
}

function manaValueOf(card) {
    const value = Number(selected(card).manaValue ?? selected(card).cmc ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function quantityOf(card) {
    const quantity = Number(card.quantity ?? 1);
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function isLand(card) {
    return /\bland\b/i.test(typeLineOf(card));
}

function isInstant(card) {
    return /\binstant\b/i.test(typeLineOf(card));
}

function compactCard(card, copyIndex = 0) {
    return {
        id: `${cardName(card)}:${copyIndex}`,
        name: cardName(card),
        manaCost: manaCostOf(card),
        manaValue: manaValueOf(card),
        typeLine: typeLineOf(card),
    };
}

function stringToSeed(value) {
    const text = String(value ?? '1');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function randomFromSeed(seed) {
    let state = stringToSeed(seed) || 1;

    return () => {
        state = Math.imul(state, 1664525) + 1013904223;
        return (state >>> 0) / 4294967296;
    };
}

function shuffle(cards, seed) {
    const shuffled = [...cards];
    const random = randomFromSeed(seed);
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
}

function groupOptions(cards) {
    const groups = new Map();
    for (const card of cards) {
        const key = `${card.name}:${card.manaCost}:${card.typeLine}`;
        const current = groups.get(key);
        if (current) {
            current.quantity += 1;
            continue;
        }

        groups.set(key, {
            ...card,
            quantity: 1,
        });
    }

    return [...groups.values()].sort((left, right) => {
        return left.manaValue - right.manaValue || left.name.localeCompare(right.name);
    });
}

function buildMainPhaseStep(player, turn, hand) {
    const landOptions = groupOptions(hand.filter(isLand));
    const availableMana = Math.min(turn, landOptions.reduce((total, land) => total + land.quantity, 0));
    const playableCards = hand.filter(card => !isLand(card) && card.manaValue <= availableMana);

    return {
        turn,
        playerKey: player.key,
        playerName: player.name,
        phase: 'main',
        availableMana,
        landOptions,
        castOptions: groupOptions(playableCards),
        holdUpOptions: groupOptions(playableCards.filter(isInstant)),
    };
}

function buildPlayer(name, key, deck, seed) {
    const library = shuffle(expandDeckCards(deck), seed);
    const openingHand = library.slice(0, 7);

    return {
        key,
        name,
        library,
        openingHand,
        libraryCount: Math.max(0, library.length - openingHand.length),
    };
}

export function expandDeckCards(cards = []) {
    const expanded = [];
    for (const card of cards) {
        for (let copyIndex = 0; copyIndex < quantityOf(card); copyIndex += 1) {
            expanded.push(compactCard(card, copyIndex));
        }
    }

    return expanded;
}

export function buildGameSimulation(currentDeck = [], opponentDeck = [], options = {}) {
    const turnCount = Math.max(1, Math.min(Number(options.turnCount ?? 2), 5));
    const seed = options.seed ?? 1;
    const you = buildPlayer('You', 'you', currentDeck, `${seed}:you`);
    const opponent = buildPlayer(options.opponentName ?? 'Meta deck', 'opponent', opponentDeck, `${seed}:opponent`);
    const timeline = [];
    const hands = {
        you: [...you.openingHand],
        opponent: [...opponent.openingHand],
    };
    const libraryIndexes = {
        you: 7,
        opponent: 7,
    };

    for (let turn = 1; turn <= turnCount; turn += 1) {
        for (const player of [you, opponent]) {
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'upkeep',
                note: 'No automatic upkeep actions in this first simulation pass.',
            });

            const skipsFirstDraw = turn === 1 && player.key === 'you';
            const drawnCard = skipsFirstDraw ? null : player.library[libraryIndexes[player.key]];
            if (drawnCard) {
                hands[player.key].push(drawnCard);
                libraryIndexes[player.key] += 1;
            }

            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'draw',
                drawnCard,
                note: skipsFirstDraw ? 'Skipped first draw.' : '',
            });
            timeline.push(buildMainPhaseStep(player, turn, hands[player.key]));
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'combat',
                note: 'Combat choices are not resolved yet.',
            });
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'end',
                holdUpOptions: buildMainPhaseStep(player, turn, hands[player.key]).holdUpOptions,
            });
        }
    }

    return {
        seed,
        turnCount,
        players: {
            you: {
                ...you,
                openingHand: groupOptions(you.openingHand),
            },
            opponent: {
                ...opponent,
                openingHand: groupOptions(opponent.openingHand),
            },
        },
        timeline,
    };
}
