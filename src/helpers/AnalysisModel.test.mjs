import { describe, expect, test } from 'vitest';
import {
    buildAnalysisCell,
    buildMetaDeckRemovalSummary
} from './AnalysisModel.mjs';

const card = (name, selectedOption, quantity = 1) => {
    return {
        name,
        quantity,
        selectedOption,
    };
};

describe('AnalysisModel', () => {
    test('Feature: Removal analysis cells name target cards with color, trade, and response details.', () => {
        const shock = card('shock', {
            manaCost: '{R}',
            manaValue: 1,
            typeLine: 'Instant',
            oracleText: 'Shock deals 2 damage to any target.',
        }, 4);
        const shoreUp = card('shore up', {
            manaCost: '{U}',
            manaValue: 1,
            typeLine: 'Instant',
            oracleText: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.',
        }, 2);
        const smallCreature = card('small creature', {
            manaValue: 2,
            typeLine: 'Creature - Mouse',
            oracleText: '',
            power: '1',
            toughness: '2',
        }, 3);
        const largeCreature = card('large creature', {
            manaValue: 3,
            typeLine: 'Creature - Beast',
            oracleText: '',
            power: '3',
            toughness: '3',
        }, 5);
        const column = {
            key: 'meta',
            label: 'Meta',
            cards: [smallCreature, largeCreature, shoreUp],
            creatures: [smallCreature, largeCreature],
            totalCards: 10,
        };

        const killCell = buildAnalysisCell(shock, { key: 'instantRemoval', label: 'Kill inst.' }, column, 'count');
        const damageCell = buildAnalysisCell(shock, { key: 'removalActions.instant.damage', label: 'Dmg inst.' }, column, 'count');
        const targetCell = buildAnalysisCell(shock, { key: 'removalActions.instant.targetable', label: 'Target inst.' }, column, 'count');
        const summary = buildMetaDeckRemovalSummary(shock, column);

        expect(killCell.display).toBe('3');
        expect(killCell.title).toContain('3x small creature - kill red; mana +1; cards even; responses: 2x shore up');
        expect(damageCell.display).toBe('5');
        expect(damageCell.title).toContain('5x large creature - damage red 2; mana +2; cards -1; responses: 2x shore up');
        expect(targetCell.display).toBe('8');
        expect(targetCell.title).toContain('3x small creature - target red; mana +1; cards even; responses: 2x shore up');
        expect(summary).toMatchObject({
            killPercent: '37.5%',
            interactionPercent: '100.0%',
            killedQuantity: 3,
            interactedQuantity: 8,
            totalCreatureQuantity: 8,
        });
    });
});
