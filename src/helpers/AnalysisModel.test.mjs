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
            killPercent: '30.0%',
            interactionPercent: '80.0%',
            killedQuantity: 3,
            interactedQuantity: 8,
            totalQuantity: 10,
        });
    });

    test('Feature: Value analysis exposes per-meta-deck removal and damage coverage for target permanent spells.', () => {
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
        const artifact = card('tablet', {
            manaValue: 3,
            typeLine: 'Artifact',
            oracleText: '',
        }, 2);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [smallCreature, largeCreature, artifact, shoreUp],
            creatures: [smallCreature, largeCreature],
            totalCards: 12,
        };

        const value = buildValueAnalysisForCard(abrade, [], [column]);
        const damageMode = value.castOptions.find(option => option.baseRows[0].effect === 'Damage 3');
        const artifactMode = value.castOptions.find(option => option.baseRows[0].effect === 'Destroy artifact');

        expect(damageMode.metaRemovalOptions).toContainEqual(expect.objectContaining({
            deckId: 'meta',
            deckName: 'Meta',
            removedPercent: '25.0%',
            damagePercent: '66.7%',
            effect: 'Battlefield removal',
            value: 'Removal coverage',
        }));
        expect(damageMode.metaRemovalOptions[0].targets).toContainEqual(expect.objectContaining({
            name: 'small creature',
            quantity: 3,
            outcome: 'kill',
            protection: '2x shore up',
        }));
        expect(damageMode.metaRemovalOptions[0].targets).toContainEqual(expect.objectContaining({
            name: 'large creature',
            quantity: 5,
            outcome: 'damage',
            protection: '2x shore up',
        }));
        expect(artifactMode.metaRemovalOptions).toContainEqual(expect.objectContaining({
            removedPercent: '16.7%',
            damagePercent: '0.0%',
        }));
        expect(artifactMode.metaRemovalOptions[0].targets).toContainEqual(expect.objectContaining({
            name: 'tablet',
            quantity: 2,
            outcome: 'remove',
        }));
    });

    test('Feature: Value analysis exposes opponent permanent target coverage even without damage.', () => {
        const inevitableDefeat = card('inevitable defeat', {
            manaCost: '{1}{R}{W}{B}',
            manaValue: 4,
            typeLine: 'Instant',
            oracleText: "This spell can't be countered.\nExile target nonland permanent. Its controller loses 3 life and you gain 3 life.",
        });
        const creature = card('small creature', {
            manaValue: 2,
            typeLine: 'Creature - Mouse',
            oracleText: '',
            power: '1',
            toughness: '3',
        }, 3);
        const artifact = card('tablet', {
            manaValue: 3,
            typeLine: 'Artifact',
            oracleText: '',
        }, 2);
        const land = card('island', {
            manaValue: 0,
            typeLine: 'Basic Land - Island',
            oracleText: '{T}: Add {U}.',
        }, 4);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [creature, artifact, land],
            creatures: [creature],
            totalCards: 9,
        };

        const value = buildValueAnalysisForCard(inevitableDefeat, [], [column]);
        const coverage = value.castOptions[0].metaRemovalOptions[0];

        expect(coverage).toMatchObject({
            deckId: 'meta',
            removedPercent: '55.6%',
            damagePercent: '0.0%',
            removedQuantity: 5,
            damagedQuantity: 0,
            totalQuantity: 9,
        });
        expect(coverage.targets).toContainEqual(expect.objectContaining({
            name: 'small creature',
            quantity: 3,
            outcome: 'remove',
        }));
        expect(coverage.targets).toContainEqual(expect.objectContaining({
            name: 'tablet',
            quantity: 2,
            outcome: 'remove',
        }));
        expect(coverage.targets.map(target => target.name)).not.toContain('island');
    });

    test('Feature: Value analysis exposes typed opponent permanent target coverage.', () => {
        const breaker = card('breaker', {
            manaCost: '{1}{G}',
            manaValue: 2,
            typeLine: 'Instant',
            oracleText: 'Destroy target artifact or enchantment.',
        });
        const artifact = card('tablet', {
            manaValue: 3,
            typeLine: 'Artifact',
            oracleText: '',
        }, 2);
        const enchantment = card('class', {
            manaValue: 1,
            typeLine: 'Enchantment - Class',
            oracleText: '',
        }, 3);
        const creature = card('creature', {
            manaValue: 2,
            typeLine: 'Creature - Mouse',
            oracleText: '',
            power: '1',
            toughness: '1',
        }, 4);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [artifact, enchantment, creature],
            creatures: [creature],
            totalCards: 9,
        };

        const value = buildValueAnalysisForCard(breaker, [], [column]);
        const coverage = value.castOptions[0].metaRemovalOptions[0];

        expect(coverage).toMatchObject({
            removedPercent: '55.6%',
            damagePercent: '0.0%',
            removedQuantity: 5,
            damagedQuantity: 0,
            totalQuantity: 9,
        });
        expect(coverage.targets).toContainEqual(expect.objectContaining({
            name: 'tablet',
            quantity: 2,
            outcome: 'remove',
        }));
        expect(coverage.targets).toContainEqual(expect.objectContaining({
            name: 'class',
            quantity: 3,
            outcome: 'remove',
        }));
        expect(coverage.targets.map(target => target.name)).not.toContain('creature');
    });

    test('Feature: Value analysis exposes SekKuar sacrifice-cost removal coverage per cast option.', () => {
        const eatenAlive = card('eaten alive', {
            manaCost: '{B}',
            manaValue: 1,
            typeLine: 'Sorcery',
            oracleText: 'As an additional cost to cast this spell, sacrifice a creature or pay {3}{B}.\nExile target creature or planeswalker.',
        });
        const viciousOffering = card('vicious offering', {
            manaCost: '{1}{B}',
            manaValue: 2,
            typeLine: 'Instant',
            oracleText: 'Kicker--Sacrifice a creature. (You may sacrifice a creature in addition to any other costs as you cast this spell.)\nTarget creature gets -2/-2 until end of turn. If this spell was kicked, that creature gets -5/-5 until end of turn instead.',
        });
        const smallCreature = card('small creature', {
            manaValue: 2,
            typeLine: 'Creature - Mouse',
            oracleText: '',
            power: '1',
            toughness: '2',
        }, 2);
        const largeCreature = card('large creature', {
            manaValue: 4,
            typeLine: 'Creature - Beast',
            oracleText: '',
            power: '4',
            toughness: '4',
        }, 3);
        const planeswalker = card('vraska', {
            manaValue: 5,
            typeLine: 'Legendary Planeswalker - Vraska',
            oracleText: '',
        }, 1);
        const artifact = card('tablet', {
            manaValue: 3,
            typeLine: 'Artifact',
            oracleText: '',
        }, 4);
        const column = {
            key: 'meta',
            label: 'Meta',
            type: 'metaDeck',
            cards: [smallCreature, largeCreature, planeswalker, artifact],
            creatures: [smallCreature, largeCreature],
            totalCards: 10,
        };

        const eatenValue = buildValueAnalysisForCard(eatenAlive, [], [column]);
        expect(eatenValue.castOptions.map(option => option.label)).toEqual(['Sacrifice creature', 'Pay {3}{B}']);
        for (const option of eatenValue.castOptions) {
            expect(option.metaRemovalOptions[0]).toMatchObject({
                removedPercent: '60.0%',
                damagePercent: '0.0%',
                removedQuantity: 6,
                damagedQuantity: 0,
                totalQuantity: 10,
            });
            expect(option.metaRemovalOptions[0].targets.map(target => target.name)).toEqual([
                'small creature',
                'large creature',
                'vraska',
            ]);
        }

        const offeringValue = buildValueAnalysisForCard(viciousOffering, [], [column]);
        const baseMode = offeringValue.castOptions.find(option => option.baseRows[0].effect === 'Debuff -2/-2');
        const kickedMode = offeringValue.castOptions.find(option => option.baseRows[0].effect === 'Debuff -5/-5');
        expect(baseMode.metaRemovalOptions[0]).toMatchObject({
            removedPercent: '20.0%',
            removedQuantity: 2,
        });
        expect(kickedMode.metaRemovalOptions[0]).toMatchObject({
            removedPercent: '50.0%',
            removedQuantity: 5,
        });
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
