function selected(card) {
    return card.selectedOption ?? card;
}

function cardName(card) {
    return card.name ?? selected(card).name ?? 'unknown card';
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function oracleTextOf(card) {
    return selected(card).oracleText ?? '';
}

function manaCostOf(card) {
    return selected(card).manaCost ?? '';
}

function manaValueOf(card) {
    const value = Number(selected(card).manaValue ?? selected(card).cmc ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function imageUrlOf(card) {
    return selected(card).urlFront ?? selected(card).imageUrl ?? '';
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

function isSorcery(card) {
    return /\bsorcery\b/i.test(typeLineOf(card));
}

function isCreature(card) {
    return /\bcreature\b/i.test(typeLineOf(card));
}

function isPermanent(card) {
    return !isInstant(card) && !isSorcery(card);
}

const phaseSequence = [
    'upkeep',
    'draw',
    'main',
    'attack',
    'blockers',
    'damageOrder',
    'secondMain',
    'end',
];

function canUseFromGraveyard(card) {
    return /\b(?:cast|play|return)\b[^.]*\bfrom your graveyard\b/i.test(oracleTextOf(card)) ||
        /\b(?:flashback|jump-start|escape|disturb|aftermath)\b/i.test(oracleTextOf(card));
}

function canUseFromExile(card) {
    return /\b(?:cast|play)\b[^.]*\bfrom exile\b/i.test(oracleTextOf(card)) ||
        /\b(?:adventure|plot|foretell|suspend)\b/i.test(oracleTextOf(card));
}

function compactCard(card, copyIndex = 0) {
    return {
        id: `${cardName(card)}:${copyIndex}`,
        name: cardName(card),
        imageUrl: imageUrlOf(card),
        manaCost: manaCostOf(card),
        manaValue: manaValueOf(card),
        oracleText: oracleTextOf(card),
        power: selected(card).power,
        toughness: selected(card).toughness,
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

function stateKey(card) {
    return JSON.stringify(card.state ?? {});
}

function groupCards(cards) {
    const groups = new Map();
    for (const card of cards) {
        const key = [
            card.name,
            card.manaCost,
            card.typeLine,
            card.sourceZone ?? '',
            JSON.stringify(card.actionState ?? null),
            stateKey(card),
        ].join(':');
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

function cardWithState(card, state = {}) {
    return {
        ...card,
        state: {
            tapped: false,
            summoningSick: false,
            modifiers: [],
            ...state,
        },
    };
}

function createMutableZones() {
    return {
        battlefield: {
            creatures: [],
            lands: [],
            nonCreaturePermanents: [],
        },
        exile: [],
        graveyard: [],
    };
}

function isMainPhase(phase) {
    return phase === 'main' || phase === 'secondMain';
}

function hasActivatedAbility(card) {
    return /(?:^|\n)\s*(?:\{[^}]+}|[A-Z0-9, ]+)?[^.\n]*:\s+/i.test(oracleTextOf(card));
}

function damageTargetProfile(card) {
    const oracleText = oracleTextOf(card);
    const anyTarget = /\bdeals? (\d+) damage to any target\b/i.exec(oracleText);
    if (anyTarget) {
        return {
            damageAmount: Number(anyTarget[1]),
            requiresTarget: true,
            targetTypes: ['player', 'creature', 'planeswalker', 'battle'],
        };
    }

    const targetCreatureOrPlaneswalker = /\bdeals? (\d+) damage to target creature or planeswalker\b/i.exec(oracleText);
    if (targetCreatureOrPlaneswalker) {
        return {
            damageAmount: Number(targetCreatureOrPlaneswalker[1]),
            requiresTarget: true,
            targetTypes: ['creature', 'planeswalker'],
        };
    }

    const targetCreature = /\bdeals? (\d+) damage to target creature\b/i.exec(oracleText);
    if (targetCreature) {
        return {
            damageAmount: Number(targetCreature[1]),
            requiresTarget: true,
            targetTypes: ['creature'],
        };
    }

    const targetPlayer = /\btarget player loses (\d+) life\b/i.exec(oracleText);
    if (targetPlayer) {
        return {
            damageAmount: Number(targetPlayer[1]),
            requiresTarget: true,
            targetTypes: ['player'],
        };
    }

    return {
        damageAmount: 0,
        requiresTarget: false,
        targetTypes: [],
    };
}

function actionOption(card, label, kind, sourceZone, extra = {}) {
    return {
        id: `${kind}:${sourceZone}:${card.id ?? card.name}`,
        kind,
        label,
        sourceZone,
        ...extra,
    };
}

function buildActionContext(playerState, phase) {
    const landOptions = playerState.hand.filter(isLand);
    const landPlaysAvailable = playerState.landPlaysAvailable ?? 1;
    const canPlayLand = isMainPhase(phase) && landPlaysAvailable > 0 && landOptions.length > 0;
    const availableMana = playerState.zones.battlefield.lands.length;

    return {
        availableMana,
        canPlayLand,
        landPlaysAvailable,
        manaForActions: availableMana + (canPlayLand ? 1 : 0),
        phase,
    };
}

function canCastInPhase(card, context) {
    if (!context) {
        return false;
    }

    if (isInstant(card)) {
        return card.manaValue <= context.manaForActions;
    }

    if (!isMainPhase(context.phase)) {
        return false;
    }

    return card.manaValue <= context.manaForActions;
}

function cardActionState(card, context, zone) {
    if (!context) {
        return null;
    }

    const actions = [];
    const options = [];
    if (zone === 'hand') {
        if (isLand(card) && context.canPlayLand) {
            actions.push('Play land');
            options.push(actionOption(card, 'Play land', 'playLand', 'hand'));
        } else if (!isLand(card) && canCastInPhase(card, context)) {
            const label = isInstant(card) ? 'Cast instant' : 'Cast';
            const targetProfile = damageTargetProfile(card);
            actions.push(label);
            options.push(actionOption(card, label, 'cast', 'hand', targetProfile));
        }
    }

    if (zone === 'graveyard' && canUseFromGraveyard(card) && canCastInPhase(card, context)) {
        actions.push('Use from graveyard');
        options.push(actionOption(card, 'Use from graveyard', 'cast', 'graveyard', damageTargetProfile(card)));
    }

    if (zone === 'exile' && canUseFromExile(card) && canCastInPhase(card, context)) {
        actions.push('Use from exile');
        options.push(actionOption(card, 'Use from exile', 'cast', 'exile', damageTargetProfile(card)));
    }

    if (zone === 'battlefield') {
        if (
            context.phase === 'attack' &&
            isCreature(card) &&
            !card.state?.tapped &&
            !card.state?.summoningSick
        ) {
            actions.push('Attack');
            options.push(actionOption(card, 'Attack', 'attack', 'battlefield'));
        }

        if (hasActivatedAbility(card)) {
            actions.push('Activate');
            options.push(actionOption(card, 'Activate', 'activate', 'battlefield'));
        }
    }

    return actions.length > 0
        ? {
            actionable: true,
            actions,
            color: 'blue',
            options,
        }
        : null;
}

function withActionState(card, context, zone) {
    const actionState = cardActionState(card, context, zone);
    return actionState
        ? {
            ...card,
            actionState,
        }
        : card;
}

function zoneSummary(cards, sourceZone, actionContext = null) {
    const recoverable = cards
        .filter(card => {
            return sourceZone === 'graveyard' ? canUseFromGraveyard(card) : canUseFromExile(card);
        })
        .map(card => {
            return withActionState({
                ...card,
                sourceZone,
            }, actionContext, sourceZone);
        });

    return {
        cards: groupCards(cards),
        count: cards.length,
        recoverable,
        top: cards.at(-1) ?? null,
    };
}

function finalizeZones(hand, library, mutableZones, actionContext = null) {
    const graveyard = zoneSummary(mutableZones.graveyard, 'graveyard', actionContext);
    const exile = zoneSummary(mutableZones.exile, 'exile', actionContext);
    const actionableHand = hand.map(card => withActionState(card, actionContext, 'hand'));
    const actionableCreatures = mutableZones.battlefield.creatures.map(card => {
        return withActionState(card, actionContext, 'battlefield');
    });
    const actionableLands = mutableZones.battlefield.lands.map(card => {
        return withActionState(card, actionContext, 'battlefield');
    });
    const actionableNonCreatures = mutableZones.battlefield.nonCreaturePermanents.map(card => {
        return withActionState(card, actionContext, 'battlefield');
    });

    return {
        battlefield: {
            creatures: groupCards(actionableCreatures),
            lands: groupCards(actionableLands),
            nonCreaturePermanents: groupCards(actionableNonCreatures),
        },
        exile,
        graveyard,
        hand: groupCards(actionableHand),
        handCount: hand.length,
        libraryCount: library.length,
        playableHand: groupCards([
            ...actionableHand,
            ...graveyard.recoverable,
            ...exile.recoverable,
        ]),
    };
}

function drawCard(playerState) {
    const card = playerState.library[playerState.libraryIndex];
    if (card) {
        playerState.hand.push(card);
        playerState.libraryIndex += 1;
    }

    return card ?? null;
}

function buildMainPhaseStep(player, turn, playerState) {
    const landOptions = groupCards(playerState.hand.filter(isLand));
    const landPlaysAvailable = playerState.landPlaysAvailable ?? 1;
    const canPlayLand = landPlaysAvailable > 0 && landOptions.length > 0;
    const availableMana = playerState.zones.battlefield.lands.length;
    const manaAfterLandPlay = availableMana + (canPlayLand ? 1 : 0);
    const playableCards = playerState.hand.filter(card => !isLand(card) && card.manaValue <= manaAfterLandPlay);

    return {
        turn,
        playerKey: player.key,
        playerName: player.name,
        phase: 'main',
        availableMana,
        landPlaysAvailable,
        landOptions,
        manaAfterLandPlay,
        castOptions: groupCards(playableCards),
        holdUpOptions: groupCards(playableCards.filter(isInstant)),
    };
}

function buildPlayerSummary(player, playerState, actionContext = null) {
    return {
        key: player.key,
        library: player.library,
        libraryCount: Math.max(0, playerState.library.length - playerState.libraryIndex),
        name: player.name,
        openingHand: groupCards(player.openingHand),
        role: player.role,
        zones: finalizeZones(
            playerState.hand,
            playerState.library.slice(playerState.libraryIndex),
            playerState.zones,
            actionContext,
        ),
    };
}

function buildPhaseStep(basePlayers, playerStates, activePlayer, turn, phase) {
    const activeState = playerStates.get(activePlayer.key);
    const actionContext = buildActionContext(activeState, phase);

    return {
        actionContext,
        phase,
        playerKey: activePlayer.key,
        playerName: activePlayer.name,
        players: basePlayers.map(player => {
            const playerState = playerStates.get(player.key);
            return buildPlayerSummary(
                player,
                playerState,
                player.key === activePlayer.key ? actionContext : null,
            );
        }),
        turn,
    };
}

function playFirstLand(playerState) {
    if ((playerState.landPlaysAvailable ?? 1) <= 0) {
        return null;
    }

    const landIndex = playerState.hand.findIndex(isLand);
    if (landIndex === -1) {
        return null;
    }

    const [land] = playerState.hand.splice(landIndex, 1);
    playerState.zones.battlefield.lands.push(cardWithState(land));
    playerState.landPlaysAvailable -= 1;
    return land;
}

function castCard(card, playerState) {
    if (isCreature(card)) {
        playerState.zones.battlefield.creatures.push(cardWithState(card, { summoningSick: true }));
        return 'battlefield';
    }

    if (isPermanent(card)) {
        playerState.zones.battlefield.nonCreaturePermanents.push(cardWithState(card));
        return 'battlefield';
    }

    if (/\bexile (?:this card|it)\b/i.test(card.oracleText)) {
        playerState.zones.exile.push(card);
        return 'exile';
    }

    playerState.zones.graveyard.push(card);
    return 'graveyard';
}

function applySimpleMainPhase(playerState, options = {}) {
    if (!options.autoPlayActions) {
        return {
            castCards: [],
            playedLand: null,
        };
    }

    const playedLand = playFirstLand(playerState);
    let remainingMana = playerState.zones.battlefield.lands.length;
    const castCards = [];

    while (remainingMana >= 0) {
        const castIndex = playerState.hand.findIndex(card => {
            return !isLand(card) && card.manaValue <= remainingMana;
        });
        if (castIndex === -1) {
            break;
        }

        const [card] = playerState.hand.splice(castIndex, 1);
        remainingMana -= card.manaValue;
        castCards.push({
            card,
            destination: castCard(card, playerState),
        });
    }

    return {
        castCards,
        playedLand,
    };
}

function buildPlayerConfig(index, options = {}) {
    const key = index === 0 ? 'you' : index === 1 ? 'opponent' : `opponent-${index}`;
    const opponentName = options.opponentName ?? 'Meta deck';
    const name = index === 0
        ? 'You'
        : index === 1
            ? opponentName
            : `${opponentName} ${index}`;

    return {
        key,
        name,
        role: options.playerRoles?.[index] ?? (index === 0 ? 'human' : 'ai'),
    };
}

function buildPlayers(currentDeck, opponentDeck, options = {}) {
    const playerCount = Math.max(2, Math.min(Number(options.playerCount ?? 2), 6));

    return Array.from({ length: playerCount }, (_, index) => {
        const config = buildPlayerConfig(index, options);
        const deck = index === 0 ? currentDeck : opponentDeck;
        const expandedDeck = expandDeckCards(deck);
        const library = options.shuffle === false
            ? expandedDeck
            : shuffle(expandedDeck, `${options.seed ?? 1}:${config.key}`);

        return {
            ...config,
            deck,
            library,
            openingHand: library.slice(0, 7),
        };
    });
}

function logLine(step) {
    const prefix = `T${step.turn} ${step.playerName} / ${step.phase}`;
    const parts = [prefix];
    if (step.drawnCard) {
        parts.push(`draw ${step.drawnCard.name}`);
    }
    if (step.playedLand) {
        parts.push(`land ${step.playedLand.name}`);
    }
    if (step.castCards?.length) {
        parts.push(`cast ${step.castCards.map(entry => entry.card.name).join(', ')}`);
    }
    if (step.note) {
        parts.push(step.note);
    }

    return parts.join(' - ');
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
    const playerSeeds = {
        seed,
    };
    const basePlayers = buildPlayers(currentDeck, opponentDeck, { ...options, seed });
    const playerStates = new Map(basePlayers.map(player => {
        return [
            player.key,
            {
                hand: [...player.openingHand],
                landPlaysAvailable: 1,
                library: player.library,
                libraryIndex: 7,
                zones: createMutableZones(),
            },
        ];
    }));
    const timeline = [];
    const phaseSteps = [];

    for (let turn = 1; turn <= turnCount; turn += 1) {
        for (const player of basePlayers) {
            const playerState = playerStates.get(player.key);
            playerState.landPlaysAvailable = 1;
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'upkeep',
                note: 'No automatic upkeep actions in this first simulation pass.',
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'upkeep'));

            const skipsFirstDraw = turn === 1 && player.key === basePlayers[0].key;
            const drawnCard = skipsFirstDraw ? null : drawCard(playerState);

            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'draw',
                drawnCard,
                note: skipsFirstDraw ? 'Skipped first draw.' : '',
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'draw'));

            const mainStep = buildMainPhaseStep(player, turn, playerState);
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'main'));
            const mainActions = applySimpleMainPhase(playerState, options);
            timeline.push({
                ...mainStep,
                ...mainActions,
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'attack'));
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'combat',
                note: 'Combat choices are not resolved yet.',
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'blockers'));
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'damageOrder'));
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'secondMain'));
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'end',
                holdUpOptions: buildMainPhaseStep(player, turn, playerState).holdUpOptions,
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'end'));
        }
    }

    const playerList = basePlayers.map(player => {
        const state = playerStates.get(player.key);
        return buildPlayerSummary(player, state);
    });
    const logLines = timeline.map(logLine);

    return {
        historyEntry: {
            id: `${Date.now()}-${seed}`,
            logLines,
            matchupName: playerList[1]?.name ?? 'Meta deck',
            playerCount: playerList.length,
            seed,
            turnCount,
        },
        phaseSequence,
        phaseSteps,
        playerList,
        playerSeeds,
        seed,
        timeline,
        turnCount,
        players: {
            you: playerList[0],
            opponent: playerList[1],
        },
    };
}
