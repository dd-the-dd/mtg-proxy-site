import { describe, expect, test } from 'vitest';
import {
    annotateSimulationPlayerActions,
    buildGameSimulation,
    expandDeckCards,
    findManaPaymentOptionsForCard,
    findNextInteractiveStepIndex,
    manaAbilitiesForCard
} from './GameSimulator.mjs';

const card = (name, quantity, selectedOption = {}) => {
    return {
        name,
        quantity,
        selectedOption,
    };
};

const quantityTotal = cards => cards.reduce((total, entry) => total + entry.quantity, 0);

describe('GameSimulator', () => {
    test('Feature: Game simulation expands card quantities into deterministic opening hands.', () => {
        const deck = [
            card('island', 4, { typeLine: 'Basic Land - Island' }),
            card('opt', 4, { manaValue: 1, typeLine: 'Instant', manaCost: '{U}' }),
            card('stormchaser talent', 4, { manaValue: 1, typeLine: 'Enchantment - Class', manaCost: '{U}' }),
        ];

        expect(expandDeckCards(deck)).toHaveLength(12);

        const first = buildGameSimulation(deck, deck, { seed: 7, turnCount: 2 });
        const second = buildGameSimulation(deck, deck, { seed: 7, turnCount: 2 });

        expect(first.players.you.openingHand.map(entry => entry.name)).toEqual(
            second.players.you.openingHand.map(entry => entry.name),
        );
        expect(quantityTotal(first.players.you.openingHand)).toBe(7);
        expect(quantityTotal(first.players.opponent.openingHand)).toBe(7);
    });

    test('Feature: Game simulation reports early turn cast and hold-up options against a meta deck.', () => {
        const currentDeck = [
            card('mountain', 8, { typeLine: 'Basic Land - Mountain' }),
            card('burst lightning', 4, {
                manaValue: 1,
                typeLine: 'Instant',
                manaCost: '{R}',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            }),
            card('slickshot show-off', 4, {
                manaValue: 2,
                typeLine: 'Creature - Bird Wizard',
                manaCost: '{1}{R}',
            }),
        ];
        const metaDeck = [
            card('island', 8, { typeLine: 'Basic Land - Island' }),
            card('opt', 4, { manaValue: 1, typeLine: 'Instant', manaCost: '{U}' }),
            card('stormchaser talent', 4, { manaValue: 1, typeLine: 'Enchantment - Class', manaCost: '{U}' }),
        ];

        const simulation = buildGameSimulation(currentDeck, metaDeck, {
            opponentName: 'Izzet Mirror',
            seed: 2,
            turnCount: 2,
        });
        const yourTurnOne = simulation.timeline.find(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'main';
        });
        const opponentTurnOne = simulation.timeline.find(step => {
            return step.turn === 1 && step.playerKey === 'opponent' && step.phase === 'main';
        });

        expect(simulation.players.opponent.name).toBe('Izzet Mirror');
        expect(yourTurnOne.landOptions.map(option => option.name)).toContain('mountain');
        expect(yourTurnOne.castOptions.map(option => option.name)).toContain('burst lightning');
        expect(yourTurnOne.holdUpOptions.map(option => option.name)).toContain('burst lightning');
        expect(opponentTurnOne.castOptions.map(option => option.name)).toEqual(
            expect.arrayContaining(['opt', 'stormchaser talent']),
        );
    });

    test('Feature: Game simulation keeps lands in hand until a land play is chosen.', () => {
        const currentDeck = [
            card('mountain', 4, { typeLine: 'Basic Land - Mountain' }),
            card('burst lightning', 4, {
                manaValue: 1,
                typeLine: 'Instant',
                manaCost: '{R}',
            }),
        ];
        const metaDeck = [
            card('island', 4, { typeLine: 'Basic Land - Island' }),
            card('opt', 4, { manaValue: 1, manaCost: '{U}', typeLine: 'Instant' }),
        ];

        const simulation = buildGameSimulation(currentDeck, metaDeck, {
            seed: 1,
            shuffle: false,
            turnCount: 1,
        });
        const yourTurnOne = simulation.timeline.find(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'main';
        });

        expect(yourTurnOne).toMatchObject({
            availableMana: 0,
            landPlaysAvailable: 1,
            manaAfterLandPlay: 1,
            playedLand: null,
        });
        expect(yourTurnOne.landOptions).toContainEqual(expect.objectContaining({
            name: 'mountain',
            quantity: 4,
        }));
        expect(yourTurnOne.castOptions).toContainEqual(expect.objectContaining({
            name: 'burst lightning',
            quantity: 3,
        }));
        expect(simulation.players.you.zones.battlefield.lands).toEqual([]);
        expect(simulation.players.you.zones.hand).toContainEqual(expect.objectContaining({
            name: 'mountain',
            quantity: 4,
        }));
    });

    test('Feature: Game simulation phase snapshots start with seven cards and mark legal actions.', () => {
        const currentDeck = [
            card('mountain', 4, { typeLine: 'Basic Land - Mountain' }),
            card('burst lightning', 4, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            }),
        ];
        const metaDeck = [
            card('island', 4, { typeLine: 'Basic Land - Island' }),
            card('opt', 4, { manaValue: 1, manaCost: '{U}', typeLine: 'Instant' }),
        ];

        const simulation = buildGameSimulation(currentDeck, metaDeck, {
            seed: 1,
            shuffle: false,
            turnCount: 1,
        });
        const firstStep = simulation.phaseSteps[0];
        const mainStep = simulation.phaseSteps.find(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'main';
        });
        const firstMainPlayer = mainStep.players.find(player => player.key === 'you');

        expect(firstStep).toMatchObject({
            turn: 1,
            playerKey: 'you',
            phase: 'upkeep',
        });
        expect(firstStep.players.find(player => player.key === 'you').zones.handCount).toBe(7);
        expect(simulation.phaseSteps.map(step => step.phase)).toEqual(
            expect.arrayContaining(['upkeep', 'draw', 'main', 'attack', 'blockers', 'damageOrder', 'secondMain', 'end']),
        );
        expect(firstMainPlayer.zones.playableHand).toContainEqual(expect.objectContaining({
            name: 'mountain',
            actionState: expect.objectContaining({
                actionable: true,
                color: 'blue',
            }),
        }));
        const burstLightning = firstMainPlayer.zones.playableHand.find(cardInHand => {
            return cardInHand.name === 'burst lightning';
        });
        expect(burstLightning.actionState).toBeUndefined();
    });

    test('Feature: Simulation action annotation preserves library counts and land enter choices.', () => {
        const shockLand = {
            id: 'shock land:0',
            name: 'shock land',
            oracleText: "As Shock Land enters, you may pay 2 life. If you don't, it enters tapped.",
            quantity: 1,
            typeLine: 'Land',
        };
        const player = {
            key: 'you',
            name: 'You',
            role: 'human',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, recoverable: [], top: null },
                graveyard: { cards: [], count: 0, recoverable: [], top: null },
                hand: [shockLand],
                handCount: 7,
                landPlaysAvailable: 1,
                libraryCount: 53,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [shockLand],
            },
        };

        const annotated = annotateSimulationPlayerActions(player, 'main', { isActivePlayer: true });
        const annotatedLand = annotated.zones.hand.find(cardInHand => {
            return cardInHand.name === 'shock land';
        });

        expect(annotated.zones.libraryCount).toBe(53);
        expect(annotatedLand.actionState.options).toEqual([
            expect.objectContaining({
                entersTapped: false,
                label: 'Play untapped, pay 2 life',
                lifePayment: 2,
            }),
            expect.objectContaining({
                entersTapped: true,
                label: 'Play tapped',
            }),
        ]);
    });

    test('Feature: Game simulation automatically advances past no-decision and dependent phase steps.', () => {
        const currentDeck = [
            card('mountain', 4, { typeLine: 'Basic Land - Mountain' }),
            card('burst lightning', 4, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            }),
        ];
        const metaDeck = [
            card('expensive spell', 8, {
                manaValue: 9,
                manaCost: '{9}',
                typeLine: 'Sorcery',
            }),
        ];

        const simulation = buildGameSimulation(currentDeck, metaDeck, {
            seed: 1,
            shuffle: false,
            turnCount: 1,
        });
        const upkeepIndex = simulation.phaseSteps.findIndex(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'upkeep';
        });
        const mainIndex = simulation.phaseSteps.findIndex(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'main';
        });
        const blockersStep = simulation.phaseSteps.find(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'blockers';
        });
        const attackIndex = simulation.phaseSteps.findIndex(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'attack';
        });
        const blockersIndex = simulation.phaseSteps.findIndex(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'blockers';
        });
        const secondMainIndex = simulation.phaseSteps.findIndex(step => {
            return step.turn === 1 && step.playerKey === 'you' && step.phase === 'secondMain';
        });
        const discardSteps = simulation.phaseSteps.filter(step => {
            return step.phase === 'discard';
        });

        expect(simulation.phaseSteps[upkeepIndex]).toMatchObject({
            availableActionCount: 0,
            autoAdvance: true,
        });
        expect(simulation.phaseSteps[mainIndex].availableActionCount).toBeGreaterThan(0);
        expect(findNextInteractiveStepIndex(simulation.phaseSteps, upkeepIndex, [])).toBe(mainIndex);
        expect(blockersStep).toMatchObject({
            autoAdvance: true,
            dependsOnAttackers: true,
        });
        expect(findNextInteractiveStepIndex(simulation.phaseSteps, attackIndex, [])).toBe(secondMainIndex);
        expect(findNextInteractiveStepIndex(simulation.phaseSteps, attackIndex, [
            {
                option: { kind: 'attack' },
                playerKey: 'you',
                stepIndex: attackIndex,
            },
        ])).toBe(blockersIndex);
        expect(discardSteps).toEqual([
            expect.objectContaining({
                discardRequired: true,
                handCount: 8,
                playerKey: 'opponent',
            }),
        ]);
    });

    test('Feature: Game simulation parses mana abilities and exposes cast payment options.', () => {
        const island = {
            id: 'island:0',
            name: 'island',
            quantity: 1,
            state: { tapped: false },
            typeLine: 'Basic Land - Island',
        };
        const mysticSanctuary = {
            id: 'mystic sanctuary:0',
            name: 'mystic sanctuary',
            oracleText: '{T}: Add {U}.',
            quantity: 1,
            state: { tapped: false },
            typeLine: 'Land',
        };
        const opt = {
            id: 'opt:0',
            manaCost: '{U}',
            manaValue: 1,
            name: 'opt',
            quantity: 1,
            typeLine: 'Instant',
        };
        const player = {
            key: 'you',
            name: 'You',
            role: 'human',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [island, mysticSanctuary],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, recoverable: [], top: null },
                graveyard: { cards: [], count: 0, recoverable: [], top: null },
                hand: [opt],
                handCount: 1,
                landPlaysAvailable: 0,
                libraryCount: 0,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [opt],
            },
        };

        expect(manaAbilitiesForCard(island)).toContainEqual(expect.objectContaining({
            manaProduced: ['U'],
        }));

        const paymentOptions = findManaPaymentOptionsForCard(opt, player);
        expect(paymentOptions.map(option => option.sources.map(source => source.name))).toEqual([
            ['island'],
            ['mystic sanctuary'],
        ]);

        const annotated = annotateSimulationPlayerActions(player, 'main', { isActivePlayer: true });
        expect(annotated.zones.battlefield.lands).toContainEqual(expect.objectContaining({
            name: 'island',
            actionState: expect.objectContaining({
                options: expect.arrayContaining([
                    expect.objectContaining({
                        kind: 'mana',
                        manaProduced: ['U'],
                    }),
                ]),
            }),
        }));
        expect(annotated.zones.hand).toContainEqual(expect.objectContaining({
            name: 'opt',
            actionState: expect.objectContaining({
                options: expect.arrayContaining([
                    expect.objectContaining({
                        kind: 'cast',
                        paymentOptions: expect.arrayContaining([
                            expect.objectContaining({
                                sources: [expect.objectContaining({ name: 'island' })],
                            }),
                            expect.objectContaining({
                                sources: [expect.objectContaining({ name: 'mystic sanctuary' })],
                            }),
                        ]),
                    }),
                ]),
            }),
        }));
    });

    test('Feature: Targeted simulation spells require a valid target before becoming actionable.', () => {
        const mountain = {
            id: 'mountain:0',
            name: 'mountain',
            quantity: 1,
            state: { tapped: false },
            typeLine: 'Basic Land - Mountain',
        };
        const flameSlash = {
            id: 'flame slash:0',
            manaCost: '{R}',
            manaValue: 1,
            name: 'flame slash',
            oracleText: 'Flame Slash deals 4 damage to target creature.',
            quantity: 1,
            typeLine: 'Sorcery',
        };
        const you = {
            key: 'you',
            name: 'You',
            role: 'human',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [mountain],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, recoverable: [], top: null },
                graveyard: { cards: [], count: 0, recoverable: [], top: null },
                hand: [flameSlash],
                handCount: 1,
                landPlaysAvailable: 0,
                libraryCount: 0,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [flameSlash],
            },
        };
        const opponent = {
            key: 'opponent',
            name: 'Opponent',
            role: 'ai',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, recoverable: [], top: null },
                graveyard: { cards: [], count: 0, recoverable: [], top: null },
                hand: [],
                handCount: 0,
                landPlaysAvailable: 0,
                libraryCount: 0,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [],
            },
        };

        const withoutTarget = annotateSimulationPlayerActions(you, 'main', {
            isActivePlayer: true,
            targetPlayers: [you, opponent],
        });
        expect(withoutTarget.zones.hand.find(cardInHand => {
            return cardInHand.name === 'flame slash';
        }).actionState).toBeUndefined();

        const opponentWithCreature = {
            ...opponent,
            zones: {
                ...opponent.zones,
                battlefield: {
                    ...opponent.zones.battlefield,
                    creatures: [
                        {
                            id: 'bear:0',
                            name: 'bear',
                            quantity: 1,
                            state: { tapped: false },
                            typeLine: 'Creature - Bear',
                        },
                    ],
                },
            },
        };
        const withTarget = annotateSimulationPlayerActions(you, 'main', {
            isActivePlayer: true,
            targetPlayers: [you, opponentWithCreature],
        });
        expect(withTarget.zones.hand).toContainEqual(expect.objectContaining({
            name: 'flame slash',
            actionState: expect.objectContaining({
                actionable: true,
                options: expect.arrayContaining([
                    expect.objectContaining({
                        requiresTarget: true,
                        targetTypes: ['creature'],
                    }),
                ]),
            }),
        }));
    });

    test('Feature: Game simulation phase snapshots surface recoverable graveyard and exile actions.', () => {
        const recoverableFromGraveyard = [
            card('mountain', 2, { typeLine: 'Basic Land - Mountain' }),
            card('grave spark', 1, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Instant',
                oracleText: 'Grave Spark deals 1 damage to any target. You may cast this card from your graveyard.',
            }),
            card('festival hopeful', 5, {
                manaValue: 1,
                typeLine: 'Creature - Human',
            }),
        ];
        const recoverableFromExile = [
            card('mountain', 2, { typeLine: 'Basic Land - Mountain' }),
            card('exile spark', 1, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Instant',
                oracleText: 'Exile Spark deals 1 damage to any target. Exile this card. You may cast this card from exile.',
            }),
            card('festival hopeful', 5, {
                manaValue: 1,
                typeLine: 'Creature - Human',
            }),
        ];
        const metaDeck = [
            card('island', 8, { typeLine: 'Basic Land - Island' }),
        ];

        const graveyardSimulation = buildGameSimulation(recoverableFromGraveyard, metaDeck, {
            autoPlayActions: true,
            seed: 1,
            shuffle: false,
            turnCount: 2,
        });
        const exileSimulation = buildGameSimulation(recoverableFromExile, metaDeck, {
            autoPlayActions: true,
            seed: 1,
            shuffle: false,
            turnCount: 2,
        });
        const graveyardMain = graveyardSimulation.phaseSteps.find(step => {
            return step.turn === 2 && step.playerKey === 'you' && step.phase === 'main';
        });
        const exileMain = exileSimulation.phaseSteps.find(step => {
            return step.turn === 2 && step.playerKey === 'you' && step.phase === 'main';
        });
        const graveyardPlayer = graveyardMain.players.find(player => player.key === 'you');
        const exilePlayer = exileMain.players.find(player => player.key === 'you');

        expect(graveyardPlayer.zones.playableHand).toContainEqual(expect.objectContaining({
            name: 'grave spark',
            sourceZone: 'graveyard',
            actionState: expect.objectContaining({
                actionable: true,
                color: 'blue',
            }),
        }));
        expect(exilePlayer.zones.playableHand).toContainEqual(expect.objectContaining({
            name: 'exile spark',
            sourceZone: 'exile',
            actionState: expect.objectContaining({
                actionable: true,
                color: 'blue',
            }),
        }));
    });

    test('Feature: Game simulation builds configurable players and visible board zones.', () => {
        const currentDeck = [
            card('mountain', 2, { typeLine: 'Basic Land - Mountain', urlFront: 'mountain-front' }),
            card('grave spark', 1, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Instant',
                oracleText: 'Grave Spark deals 1 damage to any target. You may cast this card from your graveyard.',
                urlFront: 'spark-front',
            }),
            card('festival hopeful', 2, {
                manaValue: 1,
                manaCost: '{R}',
                typeLine: 'Creature - Human',
                power: '1',
                toughness: '1',
                urlFront: 'hopeful-front',
            }),
            card('tablet', 1, {
                manaValue: 1,
                manaCost: '{1}',
                typeLine: 'Artifact',
                urlFront: 'tablet-front',
            }),
        ];
        const metaDeck = [
            card('island', 6, { typeLine: 'Basic Land - Island' }),
            card('opt', 2, { manaValue: 1, manaCost: '{U}', typeLine: 'Instant' }),
        ];

        const simulation = buildGameSimulation(currentDeck, metaDeck, {
            playerCount: 3,
            playerRoles: ['human', 'ai', 'human'],
            opponentName: 'Izzet Mirror',
            seed: 1,
            shuffle: false,
            turnCount: 2,
            autoPlayActions: true,
        });
        const you = simulation.playerList[0];

        expect(simulation.playerList.map(player => player.role)).toEqual(['human', 'ai', 'human']);
        expect(simulation.playerList[2].name).toBe('Izzet Mirror 2');
        expect(you.zones.battlefield.lands[0]).toMatchObject({
            quantity: 2,
            name: 'mountain',
        });
        expect(you.zones.battlefield.creatures[0]).toMatchObject({
            quantity: 2,
            name: 'festival hopeful',
            state: {
                tapped: false,
                summoningSick: true,
            },
        });
        expect(you.zones.graveyard.top.name).toBe('grave spark');
        expect(you.zones.playableHand).toContainEqual(expect.objectContaining({
            name: 'grave spark',
            sourceZone: 'graveyard',
        }));
        expect(simulation.historyEntry).toMatchObject({
            seed: 1,
            playerCount: 3,
            matchupName: 'Izzet Mirror',
        });
    });

    test('Feature: Game simulation can assign a distinct deck to each player.', () => {
        const currentDeck = [
            card('mountain', 8, { typeLine: 'Basic Land - Mountain' }),
        ];
        const controlDeck = [
            card('island', 8, { typeLine: 'Basic Land - Island' }),
        ];
        const aggroDeck = [
            card('forest', 8, { typeLine: 'Basic Land - Forest' }),
        ];

        const simulation = buildGameSimulation(currentDeck, controlDeck, {
            playerCount: 3,
            playerDeckNames: ['Current Deck', 'Control Meta', 'Aggro Meta'],
            playerDecks: [currentDeck, controlDeck, aggroDeck],
            shuffle: false,
            turnCount: 1,
        });

        expect(simulation.playerList.map(player => player.name)).toEqual([
            'Current Deck',
            'Control Meta',
            'Aggro Meta',
        ]);
        expect(simulation.playerList[0].zones.hand).toContainEqual(expect.objectContaining({
            name: 'mountain',
        }));
        expect(simulation.playerList[1].zones.hand).toContainEqual(expect.objectContaining({
            name: 'island',
        }));
        expect(simulation.playerList[2].zones.hand).toContainEqual(expect.objectContaining({
            name: 'forest',
        }));
    });
});
