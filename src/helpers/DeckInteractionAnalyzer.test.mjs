import { describe, expect, test } from 'vitest';
import {
    combatOutcome,
    summarizeCreatureInteractions
} from './DeckInteractionAnalyzer.mjs';

const card = (name, selectedOption) => {
    return {
        name,
        quantity: 1,
        selectedOption,
    };
};

describe('DeckInteractionAnalyzer', () => {
    test('Feature: Creature interaction analysis counts instant speed removal against a target creature.', () => {
        const burstLightning = card('burst lightning', {
            typeLine: 'Instant',
            oracleText: 'Kicker {4}. Burst Lightning deals 2 damage to any target.',
        });
        const slickshot = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste',
            power: '1',
            toughness: '2',
        });

        const summary = summarizeCreatureInteractions([burstLightning], slickshot);

        expect(summary.instantRemoval.map(item => item.name)).toEqual(['burst lightning']);
        expect(summary.sorceryRemoval).toEqual([]);
    });

    test('Feature: Creature combat analysis identifies mirrored creatures that both survive combat.', () => {
        const attacker = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste',
            power: '1',
            toughness: '2',
        });
        const defender = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste',
            power: '1',
            toughness: '2',
        });

        expect(combatOutcome(attacker, defender)).toBe('bothSurvive');
    });

    test('Feature: Creature combat analysis counts evasive attacks as player damage when the defender cannot block.', () => {
        const flyer = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste',
            power: '1',
            toughness: '2',
        });
        const groundCreature = card('ground creature', {
            typeLine: 'Creature - Human',
            oracleText: '',
            power: '2',
            toughness: '2',
        });

        expect(combatOutcome(flyer, groundCreature)).toBe('damageOnPlayer');
    });

    test('Feature: Creature interaction analysis separates attacking combat from defensive blocking.', () => {
        const flyer = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste',
            power: '1',
            toughness: '2',
        });
        const groundCreature = card('ground creature', {
            typeLine: 'Creature - Human',
            oracleText: '',
            power: '2',
            toughness: '2',
        });

        const summary = summarizeCreatureInteractions([groundCreature], flyer);

        expect(summary.combat.attacking.attackerSurvives.map(item => item.name)).toEqual(['ground creature']);
        expect(summary.combat.defending.damageOnPlayer.map(item => item.name)).toEqual(['ground creature']);
    });
});
