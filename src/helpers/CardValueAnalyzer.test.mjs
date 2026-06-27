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
            effect: 'Combat pump +1/+1 UED',
            quantity: 4,
            source: "stormchaser's talent",
            sourceLine: 'x4',
            speed: 'Sorcery',
            value: 'Creature improvement',
        }));
        expect(cast.permanentOptions.map(option => option.detail)).toContain('I:Combat pump +1/+1 UED cost 1');
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
            value: 'Direct damage; Card -1',
        });
    });

    test('Feature: Value analysis exposes kicker cast options and threshold token-copy synergies.', () => {
        const burstLightning = card('burst lightning', {
            typeLine: 'Instant',
            oracleText: 'Kicker {4}. Burst Lightning deals 2 damage to any target. If this spell was kicked, it deals 4 damage instead.',
            manaCost: '{R}',
            manaValue: 1,
        });
        const slickshot = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste\nWhenever you cast a noncreature spell, this creature gets +2/+0 until end of turn.',
            manaCost: '{1}{R}',
            power: '1',
            toughness: '2',
        }, 4);
        const colorstormStallion = card('colorstorm stallion', {
            typeLine: 'Creature - Elemental Horse',
            oracleText: 'Ward {1}, haste\nOpus — Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn. If five or more mana was spent to cast that spell, create a token that\'s a copy of this creature.',
            manaCost: '{1}{U}{R}',
            power: '3',
            toughness: '3',
        }, 3);

        const value = analyzeCardValue(burstLightning, [slickshot, colorstormStallion]);
        const base = value.castOptions.find(option => option.label === 'Cast');
        const kicked = value.castOptions.find(option => option.label === 'Kicked');

        expect(kicked.baseRows[0]).toMatchObject({
            condition: 'Kicked',
            costSymbols: ['R', '4'],
            effect: 'Damage 4',
            value: 'Direct damage; Card -1',
        });
        expect(base.permanentOptions.map(option => option.effect)).toContain('Combat pump +2/+0 UED');
        expect(base.permanentOptions.map(option => option.effect)).not.toContain('Copy token');
        expect(kicked.permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'colorstorm stallion threshold',
            effect: 'Copy token',
            costSymbols: ['5'],
            value: 'Creature token generation',
        }));
    });

    test('Feature: Value analysis parses word-number card selection and plot cast options.', () => {
        const sleightOfHand = card('sleight of hand', {
            typeLine: 'Sorcery',
            oracleText: 'Look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.',
            manaCost: '{U}',
            manaValue: 1,
        });
        const slickshot = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste\nWhenever you cast a noncreature spell, this creature gets +2/+0 until end of turn.\nPlot {1}{R}',
            manaCost: '{1}{R}',
            manaValue: 2,
        });

        expect(analyzeCardValue(sleightOfHand).castOptions[0].baseRows[0]).toMatchObject({
            effect: 'Look 2',
            value: 'Card quality improvement',
        });

        const slickshotValue = analyzeCardValue(slickshot);
        expect(slickshotValue.castOptions.map(option => option.label)).toEqual(['Cast', 'Plot']);
        expect(slickshotValue.castOptions[1].baseRows[0]).toMatchObject({
            condition: 'Plot',
            costSymbols: ['1', 'R'],
            effect: 'Exile for later cast',
            value: 'Delayed cast option; Card -1',
        });
    });
});
