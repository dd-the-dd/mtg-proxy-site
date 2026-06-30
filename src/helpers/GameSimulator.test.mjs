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
});
