import { describe, expect, test } from 'vitest';
import {
    buildAnalysisCell,
    buildMetaDeckRemovalSummary,
    buildValueAnalysisForCard
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

    test('Feature: Value analysis exposes per-meta-deck removal coverage for damage spells.', () => {
        const abrade = card('abrade', {
            manaCost: '{1}{R}',
            manaValue: 2,
            typeLine: 'Instant',
            oracleText: 'Choose one —\n• Abrade deals 3 damage to target creature.\n• Destroy target artifact.',
        });
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
            toughness: '3',
        }, 3);
        const largeCreature = card('large creature', {
            manaValue: 4,
            typeLine: 'Creature - Beast',
            oracleText: '',
            power: '4',
            toughness: '4',
        }, 5);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [smallCreature, largeCreature, shoreUp],
            creatures: [smallCreature, largeCreature],
            totalCards: 10,
        };

        const value = buildValueAnalysisForCard(abrade, [], [column]);
        const cast = value.castOptions[0];

        expect(cast.metaRemovalOptions).toContainEqual(expect.objectContaining({
            deckId: 'meta',
            deckName: 'Meta',
            removedPercent: '37.5%',
            affectedPercent: '100.0%',
            effect: 'Battlefield removal',
            value: 'Removal coverage',
        }));
        expect(cast.metaRemovalOptions[0].targets).toContainEqual(expect.objectContaining({
            name: 'small creature',
            quantity: 3,
            outcome: 'kill',
            protection: '2x shore up',
        }));
        expect(cast.metaRemovalOptions[0].targets).toContainEqual(expect.objectContaining({
            name: 'large creature',
            quantity: 5,
            outcome: 'damage',
            protection: '2x shore up',
        }));
    });

    test('Feature: Removal protection responses include instant-speed toughness triggers on the target.', () => {
        const abrade = card('abrade', {
            manaCost: '{1}{R}',
            manaValue: 2,
            typeLine: 'Instant',
            oracleText: 'Choose one —\n• Abrade deals 3 damage to target creature.\n• Destroy target artifact.',
        });
        const opt = card('opt', {
            manaCost: '{U}',
            manaValue: 1,
            typeLine: 'Instant',
            oracleText: 'Scry 1. Draw a card.',
        }, 4);
        const colorstorm = card('colorstorm stallion', {
            manaValue: 3,
            typeLine: 'Creature - Horse',
            oracleText: 'Ward {1}, haste\nOpus — Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn.',
            power: '3',
            toughness: '3',
        }, 2);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [colorstorm, opt],
            creatures: [colorstorm],
            totalCards: 6,
        };

        const value = buildValueAnalysisForCard(abrade, [], [column]);
        const target = value.castOptions[0].metaRemovalOptions[0].targets[0];

        expect(target).toMatchObject({
            name: 'colorstorm stallion',
            outcome: 'kill',
            protection: '4x opt -> colorstorm stallion +0/+1',
        });
    });
});
