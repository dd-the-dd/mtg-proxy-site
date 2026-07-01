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

function isGamePiece(card) {
    return Boolean(card?.isGamePiece || card?.isToken || selected(card).isGamePiece || selected(card).isToken);
}

function isDeckLibraryCard(card) {
    return !isGamePiece(card);
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

export const ruleEventTypes = [
    'cast',
    'enterBattlefield',
    'leaveBattlefield',
    'enterGraveyard',
    'leaveGraveyard',
    'draw',
    'mill',
    'scry',
    'surveil',
    'discard',
    'gainLife',
    'loseLife',
    'beginningOfUpkeep',
    'beginningOfDrawStep',
    'beginningOfFirstMainPhase',
    'beginningOfCombat',
    'beginningOfBlockers',
    'beginningOfDamageOrder',
    'beginningOfSecondMainPhase',
    'beginningOfEndStep',
];

const beginningEventByPhase = {
    attack: 'beginningOfCombat',
    blockers: 'beginningOfBlockers',
    damageOrder: 'beginningOfDamageOrder',
    draw: 'beginningOfDrawStep',
    end: 'beginningOfEndStep',
    main: 'beginningOfFirstMainPhase',
    secondMain: 'beginningOfSecondMainPhase',
    upkeep: 'beginningOfUpkeep',
};

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

function cardSnapshot(card) {
    if (!card) {
        return null;
    }
    const compact = compactCard(card);

    return {
        ...compact,
        id: card.id ?? compact.id,
    };
}

function normalizeRuleText(value) {
    return String(value ?? '')
        .replace(/\r/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitTriggeredAbilityClauses(text) {
    const normalized = String(text ?? '').replace(/\r/g, '\n');
    return [...normalized.matchAll(/\b(?:whenever|when|at)\b[^.]+\./gi)].map(match => {
        return normalizeRuleText(match[0]);
    });
}

function parseNumberWord(value) {
    const normalized = String(value ?? '').toLowerCase();
    const words = {
        a: 1,
        an: 1,
        eight: 8,
        five: 5,
        four: 4,
        nine: 9,
        one: 1,
        seven: 7,
        six: 6,
        ten: 10,
        three: 3,
        two: 2,
    };

    if (/^\d+$/.test(normalized)) {
        return Number(normalized);
    }

    return words[normalized] ?? 1;
}

function cardHasType(card, type) {
    return new RegExp(`\\b${type}\\b`, 'i').test(typeLineOf(card));
}

function cardMatchesHookTypes(card, cardTypes = []) {
    return cardTypes.every(type => cardHasType(card, type));
}

function deriveTokenName(effectText) {
    if (/\btreasure token\b/i.test(effectText)) {
        return 'Treasure';
    }
    if (/\bfood token\b/i.test(effectText)) {
        return 'Food';
    }
    if (/\bclue token\b/i.test(effectText)) {
        return 'Clue';
    }

    const tokenMatch = /\bcreate (?:a|an|one|\d+)?\s*(?:\d+\/\d+\s+)?(?:[a-z]+\s+)*(?:artifact\s+)?([a-z][a-z -]*?) creature token\b/i.exec(effectText);
    if (tokenMatch) {
        const words = tokenMatch[1].trim().split(/\s+/);
        return words.at(-1)?.replace(/^\w/, letter => letter.toUpperCase()) ?? 'Creature';
    }

    return 'Token';
}

function parseRuleAction(effectText) {
    const pump = /\bthis (?:creature|permanent|card)[^.]*gets \+(\d+)\/\+?(\d+) until end of turn\b/i.exec(effectText);
    if (pump) {
        return {
            name: 'modifyPermanent',
            params: {
                duration: 'untilEndOfTurn',
                powerDelta: Number(pump[1]),
                target: 'hookSource',
                toughnessDelta: Number(pump[2]),
            },
        };
    }

    const gainLife = /\byou gain (a|one|two|three|four|five|six|seven|eight|nine|ten|\d+) life\b/i.exec(effectText);
    if (gainLife) {
        return {
            name: 'gainLife',
            params: {
                amount: parseNumberWord(gainLife[1]),
                player: 'hookController',
            },
        };
    }

    const draw = /\bdraw (a|one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?\b/i.exec(effectText);
    if (draw) {
        return {
            name: 'drawCards',
            params: {
                amount: parseNumberWord(draw[1]),
                player: 'hookController',
            },
        };
    }

    if (/\bcreate\b[^.]*\btoken\b/i.test(effectText)) {
        return {
            name: 'createToken',
            params: {
                controller: 'hookController',
                tokenName: deriveTokenName(effectText),
            },
        };
    }

    return {
        name: 'unsupportedAction',
        params: {
            text: normalizeRuleText(effectText),
        },
    };
}

function castTriggerCondition(triggerText) {
    const cast = /^whenever you cast (?:an? )?(.+?) spell$/i.exec(triggerText);
    if (!cast) {
        return null;
    }

    const scope = cast[1].toLowerCase();
    if (scope.includes('noncreature')) {
        return {
            event: 'cast',
            condition: {
                name: 'spellCastMatches',
                params: {
                    cardTypes: [],
                    controller: 'hookController',
                    nonCreature: true,
                },
            },
        };
    }

    const cardTypes = [];
    for (const type of ['artifact', 'creature', 'enchantment', 'instant', 'sorcery']) {
        if (new RegExp(`\\b${type}\\b`, 'i').test(scope)) {
            cardTypes.push(type);
        }
    }

    return {
        event: 'cast',
        condition: {
            name: 'spellCastMatches',
            params: {
                cardTypes,
                controller: 'hookController',
                nonCreature: false,
            },
        },
    };
}

function enterTriggerCondition(triggerText) {
    if (/^when this .* enters$/i.test(triggerText)) {
        return {
            event: 'enterBattlefield',
            condition: {
                name: 'sourceEnteredBattlefield',
                params: {},
            },
        };
    }

    const anotherCreature = /^whenever another (nontoken )?creature you control enters$/i.exec(triggerText);
    if (anotherCreature) {
        return {
            event: 'enterBattlefield',
            condition: {
                name: 'permanentEnteredMatches',
                params: {
                    cardTypes: ['creature'],
                    controller: 'hookController',
                    excludeSource: true,
                    nontoken: Boolean(anotherCreature[1]),
                },
            },
        };
    }

    if (/^whenever this creature or another creature you control enters$/i.test(triggerText)) {
        return {
            event: 'enterBattlefield',
            condition: {
                name: 'permanentEnteredMatches',
                params: {
                    cardTypes: ['creature'],
                    controller: 'hookController',
                    excludeSource: false,
                },
            },
        };
    }

    return null;
}

function deathTriggerCondition(triggerText) {
    const anotherCreature = /^whenever another (nontoken )?creature you control dies$/i.exec(triggerText);
    if (!anotherCreature) {
        return null;
    }

    return {
        event: 'enterGraveyard',
        condition: {
            name: 'permanentMovedZones',
            params: {
                cardTypes: ['creature'],
                controller: 'hookController',
                excludeSource: true,
                fromZone: 'battlefield',
                nontoken: Boolean(anotherCreature[1]),
                toZone: 'graveyard',
            },
        },
    };
}

function lifeTriggerCondition(triggerText) {
    if (/^whenever you gain life$/i.test(triggerText)) {
        return {
            event: 'gainLife',
            condition: {
                name: 'playerLifeChanged',
                params: {
                    change: 'gain',
                    player: 'hookController',
                },
            },
        };
    }

    if (/^whenever you lose life$/i.test(triggerText)) {
        return {
            event: 'loseLife',
            condition: {
                name: 'playerLifeChanged',
                params: {
                    change: 'lose',
                    player: 'hookController',
                },
            },
        };
    }

    return null;
}

function phaseTriggerCondition(triggerText) {
    const phaseByText = [
        [/^at the beginning of your upkeep$/i, 'beginningOfUpkeep'],
        [/^at the beginning of your draw step$/i, 'beginningOfDrawStep'],
        [/^at the beginning of your first main phase$/i, 'beginningOfFirstMainPhase'],
        [/^at the beginning of your end step$/i, 'beginningOfEndStep'],
    ];

    for (const [pattern, event] of phaseByText) {
        if (pattern.test(triggerText)) {
            return {
                event,
                condition: {
                    name: 'phaseBeginsForController',
                    params: {
                        player: 'hookController',
                    },
                },
            };
        }
    }

    return null;
}

function parseRuleCondition(triggerText) {
    return castTriggerCondition(triggerText) ??
        enterTriggerCondition(triggerText) ??
        deathTriggerCondition(triggerText) ??
        lifeTriggerCondition(triggerText) ??
        phaseTriggerCondition(triggerText);
}

export function parseRuleHooksFromCard(card, options = {}) {
    const controllerKey = options.controllerKey ?? 'you';
    const sourceZone = options.sourceZone ?? 'unknown';
    const sourceCard = cardSnapshot(card);
    const hooks = [];

    for (const clause of splitTriggeredAbilityClauses(oracleTextOf(card))) {
        const match = /^(whenever|when|at)\s+([^,]+),\s+(.+)\.$/i.exec(clause);
        if (!match) {
            continue;
        }

        const triggerText = `${match[1]} ${match[2]}`.toLowerCase();
        const parsedCondition = parseRuleCondition(triggerText);
        if (!parsedCondition) {
            continue;
        }

        const action = parseRuleAction(match[3]);
        hooks.push({
            id: `${sourceCard.id}:${parsedCondition.event}:${hooks.length}`,
            action,
            condition: parsedCondition.condition,
            event: parsedCondition.event,
            sourceCard,
            sourceController: controllerKey,
            sourceId: sourceCard.id,
            sourceZone,
            triggerText: normalizeRuleText(`${match[1]} ${match[2]}`),
        });
    }

    return hooks;
}

export function createGameEngineState() {
    return {
        events: [],
        registeredHooks: [],
        stack: [],
    };
}

function playerMatchesScope(scope, hook, event) {
    if (scope === 'hookController') {
        return event.playerKey === hook.sourceController;
    }

    return true;
}

function eventSourceMatchesHookSource(hook, event) {
    return (event.card?.id ?? '') === hook.sourceId;
}

function conditionMatchesRuleEvent(hook, event) {
    if (hook.event !== event.name) {
        return false;
    }

    const params = hook.condition?.params ?? {};
    switch (hook.condition?.name) {
        case 'spellCastMatches':
            return playerMatchesScope(params.controller, hook, event) &&
                !isLand(event.card) &&
                (!params.nonCreature || !isCreature(event.card)) &&
                cardMatchesHookTypes(event.card, params.cardTypes ?? []);
        case 'sourceEnteredBattlefield':
            return eventSourceMatchesHookSource(hook, event);
        case 'permanentEnteredMatches':
            return playerMatchesScope(params.controller, hook, event) &&
                (!params.excludeSource || !eventSourceMatchesHookSource(hook, event)) &&
                (!params.nontoken || !event.card?.isToken) &&
                cardMatchesHookTypes(event.card, params.cardTypes ?? []);
        case 'permanentMovedZones':
            return event.fromZone === params.fromZone &&
                event.toZone === params.toZone &&
                playerMatchesScope(params.controller, hook, event) &&
                (!params.excludeSource || !eventSourceMatchesHookSource(hook, event)) &&
                (!params.nontoken || !event.card?.isToken) &&
                cardMatchesHookTypes(event.card, params.cardTypes ?? []);
        case 'phaseBeginsForController':
            return playerMatchesScope(params.player, hook, event);
        case 'playerLifeChanged':
            return playerMatchesScope(params.player, hook, event) &&
                (
                    (params.change === 'gain' && event.name === 'gainLife') ||
                    (params.change === 'lose' && event.name === 'loseLife')
                );
        default:
            return false;
    }
}

function normalizeGameEngineEvent(event, id) {
    return {
        id: event.id ?? `event:${id}`,
        card: cardSnapshot(event.card),
        fromZone: event.fromZone,
        name: event.name,
        phase: event.phase,
        playerKey: event.playerKey,
        toZone: event.toZone,
        turn: event.turn,
    };
}

function stackItem(type, event, extra = {}) {
    return {
        id: `${event.id}:${type}:${extra.hook?.id ?? extra.sourceCard?.id ?? event.card?.id ?? 'item'}`,
        event: event.name,
        sourceCard: extra.sourceCard ?? event.card,
        type,
        usesStack: type !== 'specialAction',
        ...(extra.hook ? {
            action: extra.hook.action,
            condition: extra.hook.condition,
            hookId: extra.hook.id,
            sourceCard: extra.hook.sourceCard,
            triggerEvent: event.name,
        } : {}),
    };
}

export function processGameEngineEvent(engineState, event) {
    const normalizedEvent = normalizeGameEngineEvent(event, engineState.events.length);
    const stackItems = [];
    engineState.events.push(normalizedEvent);

    if (normalizedEvent.name === 'cast' && normalizedEvent.card && !isLand(normalizedEvent.card)) {
        stackItems.push(stackItem('spell', normalizedEvent));
    }

    if (normalizedEvent.name === 'enterBattlefield' && normalizedEvent.card && isLand(normalizedEvent.card)) {
        stackItems.push(stackItem('specialAction', normalizedEvent));
    }

    for (const hook of engineState.registeredHooks) {
        if (conditionMatchesRuleEvent(hook, normalizedEvent)) {
            stackItems.push(stackItem('triggeredAbility', normalizedEvent, { hook }));
        }
    }

    engineState.stack.push(...stackItems);
    return {
        event: normalizedEvent,
        stackItems,
    };
}

function registerPermanentHooks(engineState, card, controllerKey) {
    const hooks = parseRuleHooksFromCard(card, {
        controllerKey,
        sourceZone: 'battlefield',
    });
    engineState.registeredHooks.push(...hooks);
    return hooks;
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

function landEnterTappedChoice(card) {
    const oracleText = oracleTextOf(card);
    if (!/\bpay 2 life\b/i.test(oracleText) || !/\benters? tapped\b/i.test(oracleText)) {
        return null;
    }

    return [
        actionOption(card, 'Play untapped, pay 2 life', 'playLand', 'hand', {
            id: `playLand:hand:${card.id ?? card.name}:pay-life`,
            entersTapped: false,
            lifePayment: 2,
        }),
        actionOption(card, 'Play tapped', 'playLand', 'hand', {
            id: `playLand:hand:${card.id ?? card.name}:tapped`,
            entersTapped: true,
        }),
    ];
}

function landPlayActionOptions(card) {
    return landEnterTappedChoice(card) ?? [
        actionOption(card, 'Play land', 'playLand', 'hand', {
            entersTapped: false,
        }),
    ];
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
            const landOptions = landPlayActionOptions(card);
            actions.push(...landOptions.map(option => option.label));
            options.push(...landOptions);
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
        libraryCount: resources.libraryCount ?? library.length,
        manaPool: normalizeManaPool(resources.manaPool),
        playableHand: groupCards([
            ...actionableHand,
            ...graveyard.recoverable,
            ...exile.recoverable,
        ]),
    };
}

function drawCard(playerState, options = {}) {
    const card = playerState.library[playerState.libraryIndex];
    if (card) {
        playerState.hand.push(card);
        playerState.libraryIndex += 1;
        if (options.engineState) {
            processGameEngineEvent(options.engineState, {
                card,
                name: 'draw',
                phase: options.phase,
                playerKey: options.player?.key,
                turn: options.turn,
            });
        }
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
        handCards: playerState.hand.map(cardSnapshot),
        key: player.key,
        library: player.library,
        libraryCount: Math.max(0, playerState.library.length - playerState.libraryIndex),
        mulligan: player.mulligan,
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
                libraryCount: player.zones?.libraryCount ?? player.libraryCount ?? 0,
                manaPool: state.manaPool,
            },
        ),
    };
}

function actionTargets(option, targetPlayers = []) {
    const targetTypes = option.targetTypes ?? [];
    const targetCandidates = targetCandidatesFromSummaryPlayers(targetPlayers);
    const cards = targetCandidates.cards.filter(candidate => {
        return cardMatchesTargetTypes(candidate.card, targetTypes);
    });
    const players = targetTypes.includes('player') ? targetCandidates.players : [];

    return {
        candidates: {
            cards,
            players,
        },
        required: Boolean(option.requiresTarget),
        targetTypes,
    };
}

function actionCosts(option, card) {
    const costs = [];
    if (option.manaCost || option.paymentOptions) {
        costs.push({
            kind: 'mana',
            manaCost: option.manaCost || manaCostOf(card),
            paymentOptions: option.paymentOptions ?? [],
        });
    }
    if (option.lifePayment) {
        costs.push({
            amount: Number(option.lifePayment),
            kind: 'life',
        });
    }
    if (['activate', 'attack', 'mana'].includes(option.kind)) {
        costs.push({
            kind: 'tap',
            source: 'self',
        });
    }

    return costs;
}

function actionConditions(option, card, player, phase) {
    const sourceZone = option.sourceZone ?? card.sourceZone ?? 'hand';
    const conditions = [];
    if (option.kind === 'playLand') {
        conditions.push(
            {
                name: 'phaseAllowsLandPlay',
                params: { phase },
            },
            {
                name: 'landPlayAvailable',
                params: {
                    remaining: player.zones?.landPlaysAvailable ?? 0,
                },
            },
        );
    }
    if (option.kind === 'cast') {
        conditions.push(
            {
                name: 'zoneAllowsCast',
                params: { sourceZone },
            },
            {
                name: 'phaseAllowsCast',
                params: {
                    phase,
                    speed: isInstant(card) ? 'instant' : 'sorcery',
                },
            },
        );
        if (option.requiresTarget) {
            conditions.push({
                name: 'validTargetAvailable',
                params: {
                    targetTypes: option.targetTypes ?? [],
                },
            });
        }
    }
    if (option.kind === 'mana') {
        conditions.push({
            name: 'permanentUntapped',
            params: { source: 'self' },
        });
    }
    if (option.kind === 'activate') {
        conditions.push(
            {
                name: 'sourceOnBattlefield',
                params: {},
            },
            {
                name: 'activatedAbilityAvailable',
                params: {},
            },
        );
    }
    if (option.kind === 'attack') {
        conditions.push({
            name: 'creatureCanAttack',
            params: {},
        });
    }

    return conditions;
}

function decisionCard(card, sourceZone) {
    return {
        ...cardSnapshot(card),
        sourceZone,
    };
}

function decisionOptionFromAction(card, rawOption, player, phase, targetPlayers) {
    const sourceZone = rawOption.sourceZone ?? card.sourceZone ?? 'hand';
    const costs = actionCosts(rawOption, card);
    const conditions = actionConditions(rawOption, card, player, phase);
    const targets = actionTargets(rawOption, targetPlayers);
    const option = {
        ...rawOption,
        conditions,
        costs,
        targets,
    };

    return {
        id: `${player.key}:${sourceZone}:${card.id ?? card.name}:${rawOption.id ?? rawOption.label}`,
        card: decisionCard(card, sourceZone),
        conditions,
        costs,
        kind: rawOption.kind,
        label: rawOption.label,
        option,
        playerKey: player.key,
        sourceZone,
        targets,
    };
}

function decisionCardsForAnnotatedPlayer(player) {
    return [
        ...(player?.zones?.playableHand ?? []),
        ...(player?.zones?.battlefield?.creatures ?? []),
        ...(player?.zones?.battlefield?.lands ?? []),
        ...(player?.zones?.battlefield?.nonCreaturePermanents ?? []),
    ].filter(card => card?.actionState?.actionable);
}

export function buildPlayerDecisionOptions(player, phase, options = {}) {
    const targetPlayers = options.targetPlayers ?? [player];
    const annotatedPlayer = options.annotatedPlayer ?? annotateSimulationPlayerActions(player, phase, {
        ...options,
        targetPlayers,
    });
    const playerOptions = decisionCardsForAnnotatedPlayer(annotatedPlayer).flatMap(card => {
        return (card.actionState?.options ?? []).map(option => {
            return decisionOptionFromAction(card, option, annotatedPlayer, phase, targetPlayers);
        });
    });
    if (options.includeAdvanceStep !== false) {
        playerOptions.push({
            id: `${annotatedPlayer.key}:game:advanceStep:${phase}`,
            card: null,
            conditions: [],
            costs: [],
            kind: 'advanceStep',
            label: 'Continue to next step',
            option: {
                id: `${annotatedPlayer.key}:game:advanceStep:${phase}`,
                kind: 'advanceStep',
                label: 'Continue to next step',
                sourceZone: 'game',
            },
            playerKey: annotatedPlayer.key,
            sourceZone: 'game',
            targets: {
                candidates: {
                    cards: [],
                    players: [],
                },
                required: false,
                targetTypes: [],
            },
        });
    }

    return {
        options: playerOptions,
        phase,
        playerKey: annotatedPlayer.key,
        playerName: annotatedPlayer.name,
        role: annotatedPlayer.role,
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

function processBeginningOfPhase(engineState, player, turn, phase) {
    const name = beginningEventByPhase[phase];
    if (!name) {
        return null;
    }

    return processGameEngineEvent(engineState, {
        name,
        phase,
        playerKey: player.key,
        turn,
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

function playFirstLand(playerState, options = {}) {
    if ((playerState.landPlaysAvailable ?? 1) <= 0) {
        return null;
    }

    const landIndex = playerState.hand.findIndex(isLand);
    if (landIndex === -1) {
        return null;
    }

    const [land] = playerState.hand.splice(landIndex, 1);
    const battlefieldLand = cardWithState(land);
    playerState.zones.battlefield.lands.push(battlefieldLand);
    playerState.landPlaysAvailable -= 1;
    if (options.engineState) {
        registerPermanentHooks(options.engineState, battlefieldLand, options.player?.key);
        processGameEngineEvent(options.engineState, {
            card: battlefieldLand,
            name: 'enterBattlefield',
            phase: options.phase,
            playerKey: options.player?.key,
            toZone: 'battlefield',
            turn: options.turn,
        });
    }
    return land;
}

function castCard(card, playerState, options = {}) {
    if (isCreature(card)) {
        const permanent = cardWithState(card, { summoningSick: true });
        playerState.zones.battlefield.creatures.push(permanent);
        if (options.engineState) {
            registerPermanentHooks(options.engineState, permanent, options.player?.key);
            processGameEngineEvent(options.engineState, {
                card: permanent,
                name: 'enterBattlefield',
                phase: options.phase,
                playerKey: options.player?.key,
                toZone: 'battlefield',
                turn: options.turn,
            });
        }
        return 'battlefield';
    }

    if (isPermanent(card)) {
        const permanent = cardWithState(card);
        playerState.zones.battlefield.nonCreaturePermanents.push(permanent);
        if (options.engineState) {
            registerPermanentHooks(options.engineState, permanent, options.player?.key);
            processGameEngineEvent(options.engineState, {
                card: permanent,
                name: 'enterBattlefield',
                phase: options.phase,
                playerKey: options.player?.key,
                toZone: 'battlefield',
                turn: options.turn,
            });
        }
        return 'battlefield';
    }

    if (/\bexile (?:this card|it)\b/i.test(card.oracleText)) {
        playerState.zones.exile.push(card);
        return 'exile';
    }

    playerState.zones.graveyard.push(card);
    if (options.engineState) {
        processGameEngineEvent(options.engineState, {
            card,
            fromZone: 'stack',
            name: 'enterGraveyard',
            phase: options.phase,
            playerKey: options.player?.key,
            toZone: 'graveyard',
            turn: options.turn,
        });
    }
    return 'graveyard';
}

function applySimpleMainPhase(playerState, options = {}) {
    if (!options.autoPlayActions) {
        return {
            castCards: [],
            playedLand: null,
        };
    }

    const playedLand = playFirstLand(playerState, {
        engineState: options.engineState,
        phase: 'main',
        player: options.player,
        turn: options.turn,
    });
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
        if (options.engineState) {
            processGameEngineEvent(options.engineState, {
                card,
                name: 'cast',
                phase: 'main',
                playerKey: options.player?.key,
                turn: options.turn,
            });
        }
        remainingMana -= card.manaValue;
        castCards.push({
            card,
            destination: castCard(card, playerState, {
                engineState: options.engineState,
                phase: 'main',
                player: options.player,
                turn: options.turn,
            }),
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
    const fallbackName = index === 0
        ? 'You'
        : index === 1
            ? opponentName
            : `${opponentName} ${index}`;
    const name = options.playerDeckNames?.[index] ?? fallbackName;

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
        const deck = options.playerDecks?.[index] ?? (index === 0 ? currentDeck : opponentDeck);
        const expandedDeck = expandDeckCards(deck);
        const mulligansTaken = mulliganCountForPlayer(options.mulliganCounts, config.key, index);
        const shuffledLibrary = options.shuffle === false
            ? expandedDeck
            : shuffle(expandedDeck, `${options.seed ?? 1}:${config.key}:mulligan:${mulligansTaken}`);
        const mulligan = buildOpeningHandFromMulligans(shuffledLibrary, {
            bottomCardIds: mulliganBottomChoicesForPlayer(options.mulliganBottomChoices, config.key, index),
            freeMulligans: options.freeMulligans,
            mulligansTaken,
        });

        return {
            ...config,
            deck,
            library: mulligan.library,
            mulligan,
            openingHand: mulligan.openingHand,
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
    for (const card of cards.filter(isDeckLibraryCard)) {
        for (let copyIndex = 0; copyIndex < quantityOf(card); copyIndex += 1) {
            expanded.push(compactCard(card, copyIndex));
        }
    }

    return expanded;
}

function normalizedNonNegativeInteger(value, fallback = 0) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function mulliganCountForPlayer(mulliganCounts = {}, playerKey, playerIndex) {
    if (Array.isArray(mulliganCounts)) {
        return normalizedNonNegativeInteger(mulliganCounts[playerIndex], 0);
    }

    return normalizedNonNegativeInteger(mulliganCounts?.[playerKey], 0);
}

function mulliganBottomChoicesForPlayer(mulliganBottomChoices = {}, playerKey, playerIndex) {
    const choice = Array.isArray(mulliganBottomChoices)
        ? mulliganBottomChoices[playerIndex]
        : mulliganBottomChoices?.[playerKey];

    if (Array.isArray(choice)) {
        return choice;
    }

    if (Array.isArray(choice?.cardIds)) {
        return choice.cardIds;
    }

    return [];
}

function bottomCardsFromChoice(drawnCards, bottomCardIds, requiredBottomCount) {
    const remainingIds = [...bottomCardIds].map(String);
    const bottomedCards = [];
    const openingHand = [];

    for (const card of drawnCards) {
        const matchingIndex = remainingIds.indexOf(String(card.id));
        if (bottomedCards.length < requiredBottomCount && matchingIndex >= 0) {
            bottomedCards.push(card);
            remainingIds.splice(matchingIndex, 1);
            continue;
        }

        openingHand.push(card);
    }

    return {
        bottomedCards,
        openingHand,
    };
}

function buildOpeningHandFromMulligans(library = [], options = {}) {
    const startingHandSize = 7;
    const mulligansTaken = normalizedNonNegativeInteger(options.mulligansTaken, 0);
    const freeMulligans = normalizedNonNegativeInteger(options.freeMulligans, 0);
    const countedMulligans = Math.max(0, mulligansTaken - freeMulligans);
    const drawnCards = library.slice(0, startingHandSize);
    const requiredBottomCount = Math.min(countedMulligans, drawnCards.length);
    const { bottomedCards, openingHand } = bottomCardsFromChoice(
        drawnCards,
        options.bottomCardIds ?? [],
        requiredBottomCount,
    );

    return {
        bottomedCards,
        bottomedCount: bottomedCards.length,
        bottomCardIds: bottomedCards.map(card => card.id),
        countedMulligans,
        freeMulligans,
        library: [
            ...openingHand,
            ...library.slice(startingHandSize),
            ...bottomedCards,
        ],
        mulligansTaken,
        openingHand,
        pendingBottomCount: Math.max(0, requiredBottomCount - bottomedCards.length),
        requiredBottomCount,
        startingHandSize,
    };
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
                libraryIndex: player.openingHand.length,
                manaPool: emptyManaPool(),
                maxHandSize: normalizeMaxHandSize(options.maxHandSize),
                zones: createMutableZones(),
            },
        ];
    }));
    const gameEngine = createGameEngineState();
    const timeline = [];
    const phaseSteps = [];

    for (let turn = 1; turn <= turnCount; turn += 1) {
        for (const player of basePlayers) {
            const playerState = playerStates.get(player.key);
            playerState.landPlaysAvailable = 1;
            processBeginningOfPhase(gameEngine, player, turn, 'upkeep');
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'upkeep',
                note: 'No automatic upkeep actions in this first simulation pass.',
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'upkeep'));

            const skipsFirstDraw = turn === 1 && player.key === basePlayers[0].key;
            processBeginningOfPhase(gameEngine, player, turn, 'draw');
            const drawnCard = skipsFirstDraw ? null : drawCard(playerState, {
                engineState: gameEngine,
                phase: 'draw',
                player,
                turn,
            });

            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'draw',
                drawnCard,
                note: skipsFirstDraw ? 'Skipped first draw.' : '',
            });
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'draw'));

            processBeginningOfPhase(gameEngine, player, turn, 'main');
            const mainStep = buildMainPhaseStep(player, turn, playerState);
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'main'));
            const mainActions = applySimpleMainPhase(playerState, {
                ...options,
                engineState: gameEngine,
                player,
                turn,
            });
            timeline.push({
                ...mainStep,
                ...mainActions,
            });
            processBeginningOfPhase(gameEngine, player, turn, 'attack');
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'attack'));
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'combat',
                note: 'Combat choices are not resolved yet.',
            });
            processBeginningOfPhase(gameEngine, player, turn, 'blockers');
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'blockers'));
            processBeginningOfPhase(gameEngine, player, turn, 'damageOrder');
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'damageOrder'));
            processBeginningOfPhase(gameEngine, player, turn, 'secondMain');
            phaseSteps.push(buildPhaseStep(basePlayers, playerStates, player, turn, 'secondMain'));
            timeline.push({
                turn,
                playerKey: player.key,
                playerName: player.name,
                phase: 'end',
                holdUpOptions: buildMainPhaseStep(player, turn, playerState).holdUpOptions,
            });
            processBeginningOfPhase(gameEngine, player, turn, 'end');
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
        gameEngine,
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
