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
    'discard',
];

const defaultMaxHandSize = 7;
const manaSymbols = ['W', 'U', 'B', 'R', 'G', 'C'];
const basicLandMana = {
    forest: 'G',
    island: 'U',
    mountain: 'R',
    plains: 'W',
    swamp: 'B',
    wastes: 'C',
};

function normalizeMaxHandSize(value) {
    const maxHandSize = Number(value ?? defaultMaxHandSize);
    return Number.isFinite(maxHandSize) ? maxHandSize : defaultMaxHandSize;
}

function emptyManaPool() {
    return manaSymbols.reduce((pool, symbol) => {
        pool[symbol] = 0;
        return pool;
    }, {});
}

function normalizeManaPool(pool = {}) {
    return manaSymbols.reduce((normalized, symbol) => {
        const amount = Number(pool[symbol] ?? 0);
        normalized[symbol] = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
        return normalized;
    }, {});
}

export function parseManaCost(manaCost = '') {
    const cost = {
        colored: emptyManaPool(),
        generic: 0,
    };
    for (const match of String(manaCost).matchAll(/\{([^}]+)\}/g)) {
        const symbol = match[1].toUpperCase();
        if (/^\d+$/.test(symbol)) {
            cost.generic += Number(symbol);
        } else if (manaSymbols.includes(symbol)) {
            cost.colored[symbol] += 1;
        }
    }

    return cost;
}

function manaCostHasRequirement(cost) {
    return cost.generic > 0 || manaSymbols.some(symbol => cost.colored[symbol] > 0);
}

function formatManaSymbols(symbols = []) {
    return symbols.map(symbol => `{${symbol}}`).join('');
}

function sourceKey(card, zoneName = '') {
    return `${zoneName}:${card.id ?? card.name}:${card.name}`;
}

function addManaToPool(pool, symbols = []) {
    const nextPool = normalizeManaPool(pool);
    for (const symbol of symbols) {
        if (manaSymbols.includes(symbol)) {
            nextPool[symbol] += 1;
        }
    }

    return nextPool;
}

function spendManaPool(pool, cost) {
    const nextPool = normalizeManaPool(pool);
    for (const symbol of manaSymbols) {
        const required = cost.colored[symbol] ?? 0;
        if (nextPool[symbol] < required) {
            return null;
        }
        nextPool[symbol] -= required;
    }

    let genericRemaining = cost.generic;
    for (const symbol of manaSymbols) {
        const spent = Math.min(nextPool[symbol], genericRemaining);
        nextPool[symbol] -= spent;
        genericRemaining -= spent;
        if (genericRemaining === 0) {
            break;
        }
    }

    return genericRemaining === 0 ? nextPool : null;
}

function canPayManaCost(pool, cost) {
    return spendManaPool(pool, cost) !== null;
}

function manaSymbolsFromBasicLand(card) {
    const typeLine = typeLineOf(card).toLowerCase();
    return Object.entries(basicLandMana)
        .filter(([subtype]) => {
            return new RegExp(`\\b${subtype}\\b`, 'i').test(typeLine);
        })
        .map(([, symbol]) => symbol);
}

function manaAbilityChoicesFromOracle(card) {
    const oracleText = oracleTextOf(card);
    const abilities = [];
    for (const match of oracleText.matchAll(/\badd ([^.]+)\./ig)) {
        const clause = match[1];
        if (/one mana of any color/i.test(clause)) {
            for (const symbol of ['W', 'U', 'B', 'R', 'G']) {
                abilities.push([symbol]);
            }
            continue;
        }

        const symbols = [...clause.matchAll(/\{([WUBRGC])\}/ig)].map(symbolMatch => {
            return symbolMatch[1].toUpperCase();
        });
        if (symbols.length === 0) {
            continue;
        }

        if (/\bor\b/i.test(clause)) {
            for (const symbol of symbols) {
                abilities.push([symbol]);
            }
        } else {
            abilities.push(symbols);
        }
    }

    return abilities;
}

function battlefieldCardsFromZones(zones = {}) {
    return [
        ...(zones.battlefield?.creatures ?? []),
        ...(zones.battlefield?.lands ?? []),
        ...(zones.battlefield?.nonCreaturePermanents ?? []),
    ];
}

function targetCandidatesFromSummaryPlayers(players = []) {
    return {
        cards: players.flatMap(player => {
            return battlefieldCardsFromZones(player.zones ?? {}).map(card => {
                return {
                    card,
                    playerKey: player.key,
                };
            });
        }),
        players: players.map(player => {
            return {
                key: player.key,
                name: player.name,
            };
        }),
    };
}

function targetCandidatesFromPlayerStates(players = [], playerStates = new Map()) {
    return {
        cards: players.flatMap(player => {
            const playerState = playerStates.get(player.key);
            return battlefieldCardsFromZones(playerState?.zones ?? {}).map(card => {
                return {
                    card,
                    playerKey: player.key,
                };
            });
        }),
        players: players.map(player => {
            return {
                key: player.key,
                name: player.name,
            };
        }),
    };
}

export function manaAbilitiesForCard(card) {
    if (card?.state?.tapped) {
        return [];
    }

    const choices = isLand(card)
        ? [
            ...manaSymbolsFromBasicLand(card).map(symbol => [symbol]),
            ...manaAbilityChoicesFromOracle(card),
        ]
        : manaAbilityChoicesFromOracle(card);

    const seen = new Set();
    return choices
        .filter(symbols => symbols.length > 0)
        .filter(symbols => {
            const key = symbols.join('');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .map(symbols => {
            return {
                label: `Tap: Add ${formatManaSymbols(symbols)}`,
                manaProduced: symbols,
            };
        });
}

function expandGroupedCards(cards = []) {
    const expanded = [];
    for (const card of cards) {
        const quantity = Number(card.quantity ?? 1);
        const count = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
        for (let index = 0; index < count; index += 1) {
            expanded.push({
                ...card,
                id: `${card.id ?? card.name}:${index}`,
                quantity: 1,
            });
        }
    }

    return expanded;
}

function manaSourcesFromZones(zones = {}) {
    const sourceZones = [
        ['lands', zones.battlefield?.lands ?? []],
        ['nonCreaturePermanents', zones.battlefield?.nonCreaturePermanents ?? []],
        ['creatures', zones.battlefield?.creatures ?? []],
    ];
    const sources = [];
    for (const [zoneName, cards] of sourceZones) {
        for (const card of expandGroupedCards(cards)) {
            const abilities = manaAbilitiesForCard(card);
            for (const ability of abilities) {
                sources.push({
                    id: sourceKey(card, zoneName),
                    manaProduced: ability.manaProduced,
                    name: card.name,
                    sourceCard: card,
                    zoneName,
                });
            }
        }
    }

    return sources;
}

function paymentLabel(payment) {
    if (payment.sources.length === 0) {
        return 'Pay from mana pool';
    }

    return `Pay with ${payment.sources.map(source => {
        return `${source.name} ${formatManaSymbols(source.manaProduced)}`;
    }).join(', ')}`;
}

export function findManaPaymentOptions(manaCost, manaPool = {}, manaSources = []) {
    const cost = parseManaCost(manaCost);
    if (!manaCostHasRequirement(cost)) {
        return [{
            id: 'free',
            label: 'No mana payment',
            manaProduced: [],
            poolAfterPayment: normalizeManaPool(manaPool),
            sources: [],
        }];
    }

    const normalizedPool = normalizeManaPool(manaPool);
    const options = [];
    const seen = new Set();

    const recordPayment = sources => {
        const manaProduced = sources.flatMap(source => source.manaProduced);
        const poolWithProduced = addManaToPool(normalizedPool, manaProduced);
        const poolAfterPayment = spendManaPool(poolWithProduced, cost);
        if (!poolAfterPayment) {
            return;
        }

        const key = sources.map(source => source.id).sort().join('|');
        if (seen.has(key)) {
            return;
        }
        seen.add(key);

        const payment = {
            id: key || 'pool',
            manaProduced,
            poolAfterPayment,
            sources: sources.map(source => {
                return {
                    id: source.id,
                    manaProduced: source.manaProduced,
                    name: source.name,
                    sourceCard: source.sourceCard,
                    zoneName: source.zoneName,
                };
            }),
        };
        payment.label = paymentLabel(payment);
        options.push(payment);
    };

    if (canPayManaCost(normalizedPool, cost)) {
        recordPayment([]);
    }

    const visit = (index, selected) => {
        if (options.length >= 20) {
            return;
        }
        if (index >= manaSources.length) {
            if (selected.length > 0) {
                recordPayment(selected);
            }
            return;
        }

        visit(index + 1, selected);
        visit(index + 1, [...selected, manaSources[index]]);
    };
    visit(0, []);

    const minimumSourceCount = Math.min(...options.map(option => option.sources.length));
    return options.filter(option => option.sources.length === minimumSourceCount).sort((left, right) => {
        return left.sources.length - right.sources.length || left.label.localeCompare(right.label);
    });
}

export function findManaPaymentOptionsForCard(card, player) {
    return findManaPaymentOptions(
        manaCostOf(card),
        player?.zones?.manaPool ?? emptyManaPool(),
        manaSourcesFromZones(player?.zones ?? {}),
    );
}

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

function cardMatchesTargetTypes(card, targetTypes = []) {
    const typeLine = typeLineOf(card);
    return (targetTypes.includes('creature') && /\bcreature\b/i.test(typeLine)) ||
        (targetTypes.includes('artifact') && /\bartifact\b/i.test(typeLine)) ||
        (targetTypes.includes('planeswalker') && /\bplaneswalker\b/i.test(typeLine)) ||
        (targetTypes.includes('battle') && /\bbattle\b/i.test(typeLine)) ||
        targetTypes.includes('permanent');
}

function hasValidTarget(targetProfile, context) {
    if (!targetProfile.requiresTarget) {
        return true;
    }

    const targetTypes = targetProfile.targetTypes ?? [];
    if (
        targetTypes.includes('player') &&
        (context.targetCandidates?.players?.length ?? 0) > 0
    ) {
        return true;
    }

    return (context.targetCandidates?.cards ?? []).some(candidate => {
        return cardMatchesTargetTypes(candidate.card ?? candidate, targetTypes);
    });
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

function buildActionContext(playerState, phase, options = {}) {
    const isActivePlayer = options.isActivePlayer ?? true;
    const landOptions = playerState.hand.filter(isLand);
    const landPlaysAvailable = playerState.landPlaysAvailable ?? 1;
    const canPlayLand = isActivePlayer && isMainPhase(phase) && landPlaysAvailable > 0 && landOptions.length > 0;
    const manaPool = normalizeManaPool(playerState.manaPool);
    const manaSources = manaSourcesFromZones(playerState.zones);
    const availableMana = manaSymbols.reduce((total, symbol) => {
        return total + manaPool[symbol];
    }, manaSources.length);

    return {
        availableMana,
        canPlayLand,
        canCastSorcerySpeed: isActivePlayer && isMainPhase(phase),
        landPlaysAvailable,
        manaForActions: availableMana,
        manaPool,
        manaSources,
        phase,
        targetCandidates: options.targetCandidates ?? { cards: [], players: [] },
    };
}

function canCastInPhase(card, context) {
    if (!context) {
        return false;
    }

    if (!isInstant(card) && !context.canCastSorcerySpeed) {
        return false;
    }

    return findManaPaymentOptions(
        manaCostOf(card) || `{${card.manaValue ?? 0}}`,
        context.manaPool,
        context.manaSources,
    ).length > 0;
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
            if (!hasValidTarget(targetProfile, context)) {
                return null;
            }
            const paymentOptions = findManaPaymentOptions(
                manaCostOf(card) || `{${card.manaValue ?? 0}}`,
                context.manaPool,
                context.manaSources,
            );
            actions.push(label);
            options.push(actionOption(card, label, 'cast', 'hand', {
                ...targetProfile,
                manaCost: manaCostOf(card),
                paymentOptions,
                requiresPayment: paymentOptions.some(payment => payment.sources.length > 0),
            }));
        }
    }

    if (zone === 'graveyard' && canUseFromGraveyard(card) && canCastInPhase(card, context)) {
        const targetProfile = damageTargetProfile(card);
        if (!hasValidTarget(targetProfile, context)) {
            return null;
        }
        const paymentOptions = findManaPaymentOptions(manaCostOf(card) || `{${card.manaValue ?? 0}}`, context.manaPool, context.manaSources);
        actions.push('Use from graveyard');
        options.push(actionOption(card, 'Use from graveyard', 'cast', 'graveyard', {
            ...targetProfile,
            manaCost: manaCostOf(card),
            paymentOptions,
            requiresPayment: paymentOptions.some(payment => payment.sources.length > 0),
        }));
    }

    if (zone === 'exile' && canUseFromExile(card) && canCastInPhase(card, context)) {
        const targetProfile = damageTargetProfile(card);
        if (!hasValidTarget(targetProfile, context)) {
            return null;
        }
        const paymentOptions = findManaPaymentOptions(manaCostOf(card) || `{${card.manaValue ?? 0}}`, context.manaPool, context.manaSources);
        actions.push('Use from exile');
        options.push(actionOption(card, 'Use from exile', 'cast', 'exile', {
            ...targetProfile,
            manaCost: manaCostOf(card),
            paymentOptions,
            requiresPayment: paymentOptions.some(payment => payment.sources.length > 0),
        }));
    }

    if (zone === 'battlefield') {
        for (const manaAbility of manaAbilitiesForCard(card)) {
            actions.push(manaAbility.label);
            options.push(actionOption(card, manaAbility.label, 'mana', 'battlefield', {
                manaProduced: manaAbility.manaProduced,
                sourceZoneName: isLand(card) ? 'lands' : isCreature(card) ? 'creatures' : 'nonCreaturePermanents',
            }));
        }

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

function finalizeZones(hand, library, mutableZones, actionContext = null, resources = {}) {
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
        landPlaysAvailable: resources.landPlaysAvailable ?? 0,
        libraryCount: library.length,
        manaPool: normalizeManaPool(resources.manaPool),
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
            {
                landPlaysAvailable: playerState.landPlaysAvailable,
                manaPool: playerState.manaPool,
            },
        ),
    };
}

function summaryZonesToMutableZones(zones = {}) {
    return {
        battlefield: {
            creatures: expandGroupedCards(zones.battlefield?.creatures ?? []),
            lands: expandGroupedCards(zones.battlefield?.lands ?? []),
            nonCreaturePermanents: expandGroupedCards(zones.battlefield?.nonCreaturePermanents ?? []),
        },
        exile: expandGroupedCards(zones.exile?.cards ?? []),
        graveyard: expandGroupedCards(zones.graveyard?.cards ?? []),
    };
}

export function annotateSimulationPlayerActions(player, phase, options = {}) {
    const mutableZones = summaryZonesToMutableZones(player.zones);
    const hand = expandGroupedCards(player.zones?.hand ?? []);
    const targetCandidates = options.targetCandidates ??
        targetCandidatesFromSummaryPlayers(options.targetPlayers ?? [player]);
    const state = {
        hand,
        landPlaysAvailable: player.zones?.landPlaysAvailable ?? 0,
        manaPool: normalizeManaPool(player.zones?.manaPool),
        zones: mutableZones,
    };
    const actionContext = buildActionContext(state, phase, {
        ...options,
        targetCandidates,
    });

    return {
        ...player,
        zones: finalizeZones(
            hand,
            [],
            mutableZones,
            actionContext,
            {
                landPlaysAvailable: state.landPlaysAvailable,
                manaPool: state.manaPool,
            },
        ),
    };
}

function countActionableCards(value) {
    if (!value) {
        return 0;
    }

    if (Array.isArray(value)) {
        return value.reduce((total, entry) => {
            return total + countActionableCards(entry);
        }, 0);
    }

    if (typeof value !== 'object') {
        return 0;
    }

    const current = value.actionState?.actionable ? Number(value.quantity ?? 1) || 1 : 0;
    return current + Object.entries(value).reduce((total, [key, entry]) => {
        if (key === 'actionState') {
            return total;
        }

        return total + countActionableCards(entry);
    }, 0);
}

function activePlayerHandCount(step) {
    return step.players.find(player => player.key === step.playerKey)?.zones.handCount ?? 0;
}

function withStepMetadata(step, playerState) {
    const handCount = activePlayerHandCount(step);
    const maxHandSize = normalizeMaxHandSize(playerState.maxHandSize);
    const availableActionCount = countActionableCards(step.players);
    const metadata = {
        availableActionCount,
        autoAdvance: availableActionCount === 0,
        handCount,
        maxHandSize,
    };

    if (step.phase === 'blockers' || step.phase === 'damageOrder') {
        metadata.autoAdvance = true;
        metadata.dependsOnAttackers = true;
    }

    if (step.phase === 'discard') {
        metadata.discardRequired = handCount > maxHandSize;
        metadata.autoAdvance = !metadata.discardRequired;
    }

    return {
        ...step,
        ...metadata,
    };
}

function buildPhaseStep(basePlayers, playerStates, activePlayer, turn, phase) {
    const activeState = playerStates.get(activePlayer.key);
    const targetCandidates = targetCandidatesFromPlayerStates(basePlayers, playerStates);
    const actionContext = buildActionContext(activeState, phase, {
        isActivePlayer: true,
        targetCandidates,
    });

    const step = {
        actionContext,
        phase,
        playerKey: activePlayer.key,
        playerName: activePlayer.name,
        players: basePlayers.map(player => {
            const playerState = playerStates.get(player.key);
            const playerActionContext = buildActionContext(playerState, phase, {
                isActivePlayer: player.key === activePlayer.key,
                targetCandidates,
            });
            return buildPlayerSummary(
                player,
                playerState,
                playerActionContext,
            );
        }),
        turn,
    };

    return withStepMetadata(step, activeState);
}

function combatAttackStepIndex(phaseSteps, step, stepIndex) {
    for (let index = stepIndex - 1; index >= 0; index -= 1) {
        const candidate = phaseSteps[index];
        if (
            candidate.turn === step.turn &&
            candidate.playerKey === step.playerKey &&
            candidate.phase === 'attack'
        ) {
            return index;
        }
    }

    return -1;
}

function hasDeclaredAttackers(phaseSteps, step, stepIndex, resolvedActions = []) {
    const attackStepIndex = combatAttackStepIndex(phaseSteps, step, stepIndex);
    if (attackStepIndex === -1) {
        return false;
    }

    return resolvedActions.some(action => {
        return action.stepIndex === attackStepIndex &&
            action.playerKey === step.playerKey &&
            action.option?.kind === 'attack';
    });
}

export function shouldAutoAdvanceStep(step, phaseSteps = [], stepIndex = -1, resolvedActions = []) {
    if (!step) {
        return true;
    }

    if (step.phase === 'blockers' || step.phase === 'damageOrder') {
        return !hasDeclaredAttackers(phaseSteps, step, stepIndex, resolvedActions);
    }

    if (step.phase === 'discard') {
        return !step.discardRequired;
    }

    return (step.availableActionCount ?? countActionableCards(step.players)) === 0;
}

export function findNextInteractiveStepIndex(phaseSteps = [], currentIndex = 0, resolvedActions = []) {
    if (phaseSteps.length === 0) {
        return 0;
    }

    let nextIndex = Math.min(currentIndex + 1, phaseSteps.length - 1);
    while (
        nextIndex < phaseSteps.length - 1 &&
        shouldAutoAdvanceStep(phaseSteps[nextIndex], phaseSteps, nextIndex, resolvedActions)
    ) {
        nextIndex += 1;
    }

    return nextIndex;
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
                manaPool: emptyManaPool(),
                maxHandSize: normalizeMaxHandSize(options.maxHandSize),
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

            if (playerState.hand.length > normalizeMaxHandSize(playerState.maxHandSize)) {
                timeline.push({
                    turn,
                    playerKey: player.key,
                    playerName: player.name,
                    phase: 'discard',
                    note: `Discard down to ${normalizeMaxHandSize(playerState.maxHandSize)}.`,
                });
                phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'discard'));
            }
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
