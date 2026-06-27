import { describe, expect, test } from 'vitest';
import { analyzeCardValue } from './CardValueAnalyzer.mjs';

const card = (name, selectedOption, quantity = 1) => {
    return {
        name,
        quantity,
        selectedOption,
    };
};

describe('CardValueAnalyzer', () => {
    test('Feature: Value analysis structures cast value and permanent-provided options into columns.', () => {
        const opt = card('opt', {
            typeLine: 'Instant',
            oracleText: 'Scry 1. Draw a card.',
            manaCost: '{U}',
            manaValue: 1,
        });
        const stormchaserTalent = card("stormchaser's talent", {
            typeLine: 'Enchantment - Class',
            oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.\n{3}{U}: Level 2\nWhen this Class becomes level 2, return target instant or sorcery card from your graveyard to your hand.\n{5}{U}: Level 3\nWhenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
            manaCost: '{U}',
            manaValue: 1,
            relatedTokens: [
                {
                    name: 'otter',
                    typeLine: 'Token Creature - Otter',
                    oracleText: 'Prowess',
                    power: '1',
                    toughness: '1',
                },
            ],
        }, 4);

        const value = analyzeCardValue(opt, [stormchaserTalent]);
        const cast = value.castOptions[0];

        expect(cast.symbols).toEqual(['U']);
        expect(cast.baseRows[0]).toMatchObject({
            condition: 'Cast',
            cost: '{U}',
            costSymbols: ['U'],
            effect: 'Scry 1, Draw 1',
            speed: 'Instant',
            value: 'Card quality improvement',
        });
        expect(cast.values).toContainEqual({ label: 'Effect', value: 'Scry 1' });
        expect(cast.values).not.toContainEqual({ label: 'State', value: 'Card 0' });
        expect(cast.permanentOptions).toContainEqual(expect.objectContaining({
            condition: "stormchaser's talent class 1",
            cost: '1',
            costSymbols: ['1'],
            effect: 'Feed 1+1 UED',
            quantity: 4,
            source: "stormchaser's talent",
            sourceLine: 'x4',
            speed: 'Sorcery',
            value: 'Creature improvement',
        }));
        expect(cast.permanentOptions.map(option => option.detail)).toContain('I:Feed 1+1 UED cost 1');
        expect(cast.permanentOptions.map(option => option.detail)).toContain('S:Token engine cost 11');
        expect(cast.permanentOptions.map(option => option.detail)).not.toContain('S:Grave to hand cost 5');
        expect(value.zoneOptions).toContainEqual(expect.objectContaining({
            condition: "stormchaser's talent class 2",
            cost: '5',
            effect: 'Grave to hand',
            quantity: 4,
            value: 'Card recursion',
        }));
        expect(cast.bonuses).toEqual([]);
        expect(cast.zoneChanges).toEqual([]);
    });

    test('Feature: Value analysis shows card loss for spells that do not draw.', () => {
        const burstLightning = card('burst lightning', {
            typeLine: 'Instant',
            oracleText: 'Burst Lightning deals 2 damage to any target.',
            manaCost: '{R}',
            manaValue: 1,
        });

        const value = analyzeCardValue(burstLightning);
        const cast = value.castOptions[0];

        expect(cast.baseRows[0]).toMatchObject({
            condition: 'Cast',
            cost: '{R}',
            speed: 'Instant',
            value: 'Card -1',
        });
    });
});
