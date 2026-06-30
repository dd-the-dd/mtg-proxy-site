import { describe, expect, test } from 'vitest';
import {
    buildGameSimulation,
    expandDeckCards
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
        expect(firstMainPlayer.zones.playableHand).toContainEqual(expect.objectContaining({
            name: 'burst lightning',
            actionState: expect.objectContaining({
                actionable: true,
                color: 'blue',
                options: expect.arrayContaining([
                    expect.objectContaining({
                        damageAmount: 2,
                        kind: 'cast',
                        requiresTarget: true,
                        targetTypes: expect.arrayContaining(['player', 'creature']),
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
});
