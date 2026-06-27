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
    test('Feature: Value analysis shows Opt hand parity, card quality, and Stormchaser permanent options.', () => {
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
        expect(cast.values).toContainEqual({ label: 'Hand', value: '0' });
        expect(cast.values).toContainEqual({ label: 'Quality', value: 'Scry 1' });
        expect(cast.permanentOptions.map(option => option.detail)).toContain('I:Feed 1+1 UED cost 1');
        expect(cast.permanentOptions.map(option => option.detail)).toContain('S:Token engine cost 11');
        expect(cast.permanentOptions.map(option => option.detail)).toContain('S:Grave to hand cost 5');
        expect(cast.bonuses).toEqual([]);
        expect(cast.zoneChanges).toEqual([]);
    });
});
