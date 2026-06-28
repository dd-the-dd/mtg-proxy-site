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
        expect(cast.permanentOptions.map(option => option.detail)).not.toContain('S:Combat pump +1/+1 UED cost 1');
        expect(cast.permanentOptions.map(option => option.detail)).toContain('S:Token engine cost 11');
        expect(cast.permanentOptions.map(option => option.detail)).not.toContain('S:Grave to hand cost 5');
        expect(cast.manaOptions).toEqual([]);
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

    test('Feature: Value analysis separates token generation from generated-token combat synergies.', () => {
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
        });
        const opt = card('opt', {
            typeLine: 'Instant',
            oracleText: 'Scry 1. Draw a card.',
            manaCost: '{U}',
            manaValue: 1,
        });
        const otter = card('otter', {
            typeLine: 'Token Creature - Otter',
            oracleText: 'Prowess',
            power: '1',
            toughness: '1',
            isToken: true,
            isGamePiece: true,
        }, 1);

        const stormchaserValue = analyzeCardValue(stormchaserTalent);
        expect(stormchaserValue.castOptions[0].baseRows[0]).toMatchObject({
            effect: 'Create 1/1 Otter with prowess',
            value: 'Creature token generation; Card -1',
        });

        const optValue = analyzeCardValue(opt, [stormchaserTalent, otter]);
        const permanentOptions = optValue.castOptions[0].permanentOptions;
        expect(permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'otter',
            cost: '{U}',
            costSymbols: ['U'],
            effect: 'Combat pump +1/+1 UED',
            source: 'otter',
            value: 'Creature improvement',
        }));
        expect(permanentOptions).not.toContainEqual(expect.objectContaining({
            condition: "stormchaser's talent class 1",
            effect: 'Combat pump +1/+1 UED',
        }));
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
        expect(base.permanentOptions).toContainEqual(expect.objectContaining({
            effect: 'Combat pump +2/+0 UED',
            cost: '{R}',
            costSymbols: ['R'],
        }));
        expect(base.permanentOptions.map(option => option.effect)).not.toContain('Copy token');
        expect(kicked.permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'colorstorm stallion threshold',
            effect: 'Copy token',
            cost: '{R}{4}',
            costSymbols: ['R', '4'],
            actionCost: '5',
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

    test('Feature: Value analysis exposes activated abilities on permanents and lands.', () => {
        const greatHall = card('great hall of the biblioplex', {
            typeLine: 'Land',
            oracleText: '{T}: Add {C}.\n{5}: If this land isn\'t a creature, it becomes a 2/4 Wizard creature with "Whenever you cast an instant or sorcery spell, this creature gets +1/+0 until end of turn."',
            manaCost: '',
            manaValue: 0,
        });
        const drakeHatcher = card('drake hatcher', {
            typeLine: 'Creature - Human Wizard',
            oracleText: 'Whenever you cast an instant or sorcery spell, put an incubation counter on this creature.\nRemove three incubation counters from this creature: Create a 2/2 blue Drake creature token with flying.',
            manaCost: '{2}{U}',
            manaValue: 3,
        });

        const hallValue = analyzeCardValue(greatHall);
        expect(hallValue.castOptions).toEqual([]);
        expect(hallValue.activatedOptions).toContainEqual(expect.objectContaining({
            condition: 'Activated ability',
            cost: '{T}',
            costSymbols: ['T'],
            effect: 'Add {C}',
            speed: 'Sorcery',
            value: 'Mana production',
        }));
        expect(hallValue.activatedOptions).toContainEqual(expect.objectContaining({
            condition: 'Activated ability',
            cost: '{5}',
            costSymbols: ['5'],
            effect: 'Become 2/4 Wizard creature',
            value: 'Creature conversion; Creature improvement',
        }));

        const drakeValue = analyzeCardValue(drakeHatcher);
        expect(drakeValue.activatedOptions).toContainEqual(expect.objectContaining({
            condition: '3 incubation counters',
            cost: 'Remove three incubation counters from this creature',
            costSymbols: [],
            effect: 'Create 2/2 Drake with flying',
            value: 'Creature token generation',
        }));
    });

    test('Feature: Activated ability parsing ignores reminder-text abilities granted to created tokens.', () => {
        const pitilessPlunderer = card('pitiless plunderer', {
            typeLine: 'Creature - Human Pirate',
            oracleText: 'Whenever another creature you control dies, create a Treasure token. (It\'s an artifact with "{T}, Sacrifice this token: Add one mana of any color.")',
            manaCost: '{3}{B}',
            manaValue: 4,
        });
        const grimBackwoods = card('grim backwoods', {
            typeLine: 'Land',
            oracleText: '{T}: Add {C}.\n{2}{B}{G}, {T}, Sacrifice a creature: Draw a card.',
            manaCost: '',
            manaValue: 0,
        });

        expect(analyzeCardValue(pitilessPlunderer).activatedOptions).toEqual([]);
        expect(analyzeCardValue(grimBackwoods).activatedOptions).toContainEqual(expect.objectContaining({
            cost: '{2}{B}{G}, {T}, Sacrifice a creature',
            effect: 'Draw a card',
            value: 'Card draw',
        }));
    });

    test('Feature: Value analysis shows passive ETB lifegain supplied by another permanent.', () => {
        const lumaret = card('bogwater lumaret', {
            typeLine: 'Creature - Frog',
            oracleText: 'Whenever this creature or another creature you control enters, you gain 1 life.',
            manaCost: '{B}{G}',
            manaValue: 2,
            power: '2',
            toughness: '2',
        }, 2);
        const rat = card('persistent specimen', {
            typeLine: 'Creature - Skeleton',
            oracleText: '',
            manaCost: '{B}',
            manaValue: 1,
            power: '1',
            toughness: '1',
        }, 4);
        const swamp = card('swamp', {
            typeLine: 'Basic Land - Swamp',
            oracleText: '{T}: Add {B}.',
            manaCost: '',
            manaValue: 0,
        }, 8);

        const ratValue = analyzeCardValue(rat, [lumaret, swamp]);
        expect(ratValue.castOptions[0].etbOptions).toContainEqual(expect.objectContaining({
            condition: 'bogwater lumaret',
            cost: '{B}',
            costSymbols: ['B'],
            actionCost: '1',
            effect: 'ETB life gain +1',
            quantity: 2,
            sourceLine: 'x2',
            speed: 'Sorcery',
            value: 'Life gain',
        }));
        expect(ratValue.castOptions[0].manaOptions).toContainEqual(expect.objectContaining({
            condition: 'swamp',
            costSymbols: ['T'],
            effect: 'Add {B}',
            sourceLine: 'x8',
            value: 'Pays {B}',
        }));
    });

    test('Feature: Value analysis shows passive death payoffs supplied by another permanent.', () => {
        const bloodArtist = card('blood artist', {
            typeLine: 'Creature - Vampire',
            oracleText: 'Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.',
            manaCost: '{1}{B}',
            manaValue: 2,
            power: '0',
            toughness: '1',
        });
        const pitilessPlunderer = card('pitiless plunderer', {
            typeLine: 'Creature - Human Pirate',
            oracleText: 'Whenever another creature you control dies, create a Treasure token.',
            manaCost: '{3}{B}',
            manaValue: 4,
            power: '1',
            toughness: '4',
        });
        const rat = card('persistent specimen', {
            typeLine: 'Creature - Skeleton',
            oracleText: '',
            manaCost: '{B}',
            manaValue: 1,
            power: '1',
            toughness: '1',
        });

        const value = analyzeCardValue(rat, [bloodArtist, pitilessPlunderer]);
        const options = value.deathOptions;
        expect(value.castOptions[0].permanentOptions).toEqual([]);
        expect(options).toContainEqual(expect.objectContaining({
            condition: 'blood artist',
            effect: 'Death drain +1',
            cost: '1',
            value: 'Life drain',
        }));
        expect(options).toContainEqual(expect.objectContaining({
            condition: 'pitiless plunderer',
            effect: 'Death treasure',
            cost: '1',
            value: 'Treasure generation',
        }));
    });

    test('Feature: Value analysis shows colored land sources that can pay a cast option.', () => {
        const opt = card('opt', {
            typeLine: 'Instant',
            oracleText: 'Scry 1. Draw a card.',
            manaCost: '{U}',
            manaValue: 1,
        });
        const island = card('island', {
            typeLine: 'Basic Land - Island',
            oracleText: '{T}: Add {U}.',
            manaCost: '',
            manaValue: 0,
        }, 6);
        const mountain = card('mountain', {
            typeLine: 'Basic Land - Mountain',
            oracleText: '{T}: Add {R}.',
            manaCost: '',
            manaValue: 0,
        }, 4);

        const manaOptions = analyzeCardValue(opt, [island, mountain]).castOptions[0].manaOptions;

        expect(manaOptions).toContainEqual(expect.objectContaining({
            condition: 'island',
            costSymbols: ['T'],
            effect: 'Add {U}',
            sourceLine: 'x6',
            value: 'Pays {U}',
        }));
        expect(manaOptions.map(option => option.condition)).not.toContain('mountain');
    });

    test('Feature: Value analysis shows bounce zone movement for non-land permanents only.', () => {
        const boomerang = card('boomerang', {
            typeLine: 'Instant',
            oracleText: "Return target permanent to its owner's hand.",
            manaCost: '{U}{U}',
            manaValue: 2,
        });
        const arcaneSignet = card('arcane signet', {
            typeLine: 'Artifact',
            oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
            manaCost: '{2}',
            manaValue: 2,
        });
        const forest = card('forest', {
            typeLine: 'Basic Land - Forest',
            oracleText: '{T}: Add {G}.',
            manaCost: '',
            manaValue: 0,
        });

        const zoneOptions = analyzeCardValue(boomerang, [arcaneSignet, forest]).zoneOptions;

        expect(zoneOptions).toContainEqual(expect.objectContaining({
            condition: 'Action 2',
            effect: 'Battlefield to hand draw',
            source: 'arcane signet',
            value: 'Battlefield reset',
        }));
        expect(zoneOptions.map(option => option.source)).not.toContain('forest');
    });
});
