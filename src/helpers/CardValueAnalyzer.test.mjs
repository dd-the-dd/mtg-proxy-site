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
        expect(cast.permanentOptions).toContainEqual(expect.objectContaining({
            condition: "stormchaser's talent class 3",
            cost: '{U}{3}{U}{5}{U}',
            costSymbols: ['U', '3', 'U', '5', 'U'],
            actionCost: '11',
            effect: 'Token engine',
        }));
        expect(cast.permanentOptions.map(option => option.detail)).not.toContain('S:Grave to hand cost 5');
        expect(cast.manaOptions).toEqual([]);
        expect(value.zoneOptions).toContainEqual(expect.objectContaining({
            condition: "stormchaser's talent class 2",
            cost: '{U}{3}{U}',
            costSymbols: ['U', '3', 'U'],
            actionCost: '5',
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
            cost: '',
            costSymbols: [],
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
            cost: '{1}{R}',
            costSymbols: ['1', 'R'],
        }));
        expect(base.permanentOptions.map(option => option.effect)).not.toContain('Copy token');
        expect(kicked.permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'colorstorm stallion threshold',
            effect: 'Copy token',
            cost: '{1}{U}{R}',
            costSymbols: ['1', 'U', 'R'],
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
            effect: 'Look 2, Select 1',
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
            cost: '{B}{G}',
            costSymbols: ['B', 'G'],
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
            cost: '{1}{B}',
            costSymbols: ['1', 'B'],
            actionCost: '1',
            value: 'Life drain',
        }));
        expect(options).toContainEqual(expect.objectContaining({
            condition: 'pitiless plunderer',
            effect: 'Death token Treasure',
            cost: '{3}{B}',
            costSymbols: ['3', 'B'],
            actionCost: '1',
            value: 'Treasure generation',
        }));
    });

    test('Feature: Value analysis names creature tokens generated by death payoffs.', () => {
        const sekkuar = card("sek'kuar, deathkeeper", {
            typeLine: 'Legendary Creature - Orc Shaman',
            oracleText: 'Whenever another nontoken creature you control dies, create a 3/1 black and red Graveborn creature token with haste.',
            manaCost: '{2}{B}{R}{G}',
            manaValue: 5,
            power: '4',
            toughness: '3',
        });
        const rat = card('persistent specimen', {
            typeLine: 'Creature - Skeleton',
            oracleText: '',
            manaCost: '{B}',
            manaValue: 1,
            power: '1',
            toughness: '1',
        });

        expect(analyzeCardValue(rat, [sekkuar]).deathOptions).toContainEqual(expect.objectContaining({
            condition: "sek'kuar, deathkeeper",
            effect: 'Death token 3/1 Graveborn with haste',
            cost: '{2}{B}{R}{G}',
            costSymbols: ['2', 'B', 'R', 'G'],
            actionCost: '1',
            value: 'Creature token generation',
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
            display: 'chip',
            effect: 'Add {U}',
            kind: 'land-payment',
            producedSymbolGroups: [['U']],
            sourceLine: 'x6',
            value: 'Pays {U}',
        }));
        expect(manaOptions.map(option => option.condition)).not.toContain('mountain');
    });

    test('Feature: Value analysis distinguishes colorless generic payment and mana alternatives.', () => {
        const spell = card('fire prophecy', {
            typeLine: 'Instant',
            oracleText: 'Fire Prophecy deals 3 damage to target creature.',
            manaCost: '{2}{R}',
            manaValue: 3,
        });
        const greatHall = card('great hall of the biblioplex', {
            typeLine: 'Land',
            oracleText: '{T}: Add {C}.',
            manaCost: '',
            manaValue: 0,
        }, 4);
        const riverpyreVerge = card('riverpyre verge', {
            typeLine: 'Land',
            oracleText: '{T}: Add {U} or {R}.',
            manaCost: '',
            manaValue: 0,
        }, 2);
        const tablet = card('tablet of discovery', {
            typeLine: 'Artifact',
            oracleText: 'When this artifact enters, mill a card. You may play that card this turn.\n{T}: Add {R}.\n{T}: Add {R}{R}. Spend this mana only to cast instant and sorcery spells.',
            manaCost: '{2}{R}',
            manaValue: 3,
        }, 4);

        const manaOptions = analyzeCardValue(spell, [greatHall, riverpyreVerge, tablet]).castOptions[0].manaOptions;

        expect(manaOptions).toContainEqual(expect.objectContaining({
            condition: 'great hall of the biblioplex',
            display: 'chip',
            kind: 'land-payment',
            producedSymbolGroups: [['C']],
            value: 'Pays {1}',
        }));
        expect(manaOptions).toContainEqual(expect.objectContaining({
            condition: 'riverpyre verge',
            display: 'chip',
            kind: 'land-payment',
            producedSymbolGroups: [['U'], ['R']],
            value: 'Pays {R}',
        }));
        expect(manaOptions).toContainEqual(expect.objectContaining({
            condition: 'tablet of discovery',
            display: 'row',
            effect: 'Add {R}{R}. Spend this mana only to cast instant and sorcery spells',
            kind: 'payment',
            producedSymbolGroups: [['R', 'R']],
            value: 'Pays {R}{1}',
        }));
    });

    test('Feature: Value analysis treats restricted artifact mana as a source only for matching spell casts.', () => {
        const thunderMagic = card('thunder magic', {
            typeLine: 'Instant',
            oracleText: 'Thunder Magic deals 2 damage to target creature.',
            manaCost: '{R}',
            manaValue: 1,
        });
        const sanar = card('sanar, unfinished genius', {
            typeLine: 'Legendary Creature - Goblin Sorcerer // Sorcery',
            oracleText: "Sanar enters prepared.\n{T}: Create a Treasure token. Activate only if you've cast an instant or sorcery spell this turn.\nSearch your library for an instant or sorcery card, reveal it, put it into your hand, then shuffle.",
            manaCost: '{U}{R} // {3}{U}{R}',
            manaValue: 2,
            power: '0',
            toughness: '4',
        });
        const tablet = card('tablet of discovery', {
            typeLine: 'Artifact',
            oracleText: 'When this artifact enters, mill a card. You may play that card this turn.\n{T}: Add {R}.\n{T}: Add {R}{R}. Spend this mana only to cast instant and sorcery spells.',
            manaCost: '{2}{R}',
            manaValue: 3,
        }, 4);

        const thunderMana = analyzeCardValue(thunderMagic, [tablet]).castOptions[0].manaOptions;
        expect(analyzeCardValue(tablet).activatedOptions).toContainEqual(expect.objectContaining({
            cost: '{T}',
            effect: 'Add {R}{R}',
            value: 'Mana production',
        }));
        expect(thunderMana).toContainEqual(expect.objectContaining({
            condition: 'tablet of discovery',
            display: 'row',
            effect: 'Add {R}{R}. Spend this mana only to cast instant and sorcery spells',
            kind: 'payment',
            producedSymbolGroups: [['R', 'R']],
            producedSymbols: ['R', 'R'],
            sourceLine: 'x4',
            value: 'Pays {R}',
        }));

        const sanarValue = analyzeCardValue(sanar, [tablet]);
        expect(sanarValue.castOptions.find(option => option.label === 'Cast').manaOptions).not.toContainEqual(expect.objectContaining({
            effect: 'Add {R}{R}. Spend this mana only to cast instant and sorcery spells',
        }));
        expect(sanarValue.castOptions.find(option => option.label === 'Spell face').manaOptions).toContainEqual(expect.objectContaining({
            effect: 'Add {R}{R}. Spend this mana only to cast instant and sorcery spells',
            producedSymbols: ['R', 'R'],
        }));
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
            condition: 'Opponent permanent',
            cost: '{U}{U}',
            costSymbols: ['U', 'U'],
            effect: 'Battlefield to hand',
            source: 'boomerang',
            value: 'Battlefield reset',
        }));
        expect(zoneOptions).toContainEqual(expect.objectContaining({
            condition: 'arcane signet',
            cost: '{U}{U}',
            costSymbols: ['U', 'U'],
            effect: 'Battlefield to hand + draw',
            source: 'arcane signet',
            value: 'Battlefield reset; Card draw',
        }));
        expect(zoneOptions.map(option => option.source)).not.toContain('forest');
    });

    test('Feature: Value analysis gives every creature instant creature-shape options from modal spells.', () => {
        const elemental = card('elemental token', {
            typeLine: 'Creature - Elemental',
            oracleText: '',
            manaCost: '{1}{R}',
            manaValue: 2,
            power: '2',
            toughness: '2',
        });
        const waterbending = card('waterbending technique', {
            typeLine: 'Instant',
            oracleText: 'Choose one — Target creature has base power and toughness 1/1 until end of turn and gains hexproof until end of turn; or target creature has base power and toughness 3/4 until end of turn and gains flying and vigilance until end of turn.',
            manaCost: '{U}',
            manaValue: 1,
        }, 2);
        const arcaneSignet = card('arcane signet', {
            typeLine: 'Artifact',
            oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
            manaCost: '{2}',
            manaValue: 2,
        });

        const creatureOptions = analyzeCardValue(elemental, [waterbending]).creatureOptions;
        const nonCreatureOptions = analyzeCardValue(arcaneSignet, [waterbending]).creatureOptions;

        expect(creatureOptions).toContainEqual(expect.objectContaining({
            condition: 'waterbending technique',
            cost: '{U}',
            costSymbols: ['U'],
            effect: 'Become 1/1 with hexproof',
            sourceLine: 'x2',
            speed: 'Instant',
            value: 'Creature protection',
        }));
        expect(creatureOptions).toContainEqual(expect.objectContaining({
            condition: 'waterbending technique',
            cost: '{U}',
            costSymbols: ['U'],
            effect: 'Become 3/4 with flying and vigilance',
            speed: 'Instant',
            value: 'Creature improvement',
        }));
        expect(nonCreatureOptions).toEqual([]);
    });

    test('Feature: Value analysis parses 4c control modal, tiered, spree, and counter spell options.', () => {
        const thunderMagic = card('thunder magic', {
            typeLine: 'Instant',
            oracleText: 'Tiered (Choose one additional cost.)\n* Thunder - {0} - Thunder Magic deals 2 damage to target creature.\n* Thundara - {3} - Thunder Magic deals 4 damage to target creature.\n* Thundaga - {5}{R} - Thunder Magic deals 8 damage to target creature.',
            manaCost: '{R}',
            manaValue: 1,
        });
        const returnTheFavor = card('return the favor', {
            typeLine: 'Instant',
            oracleText: 'Spree (Choose one or more additional costs.)\n+ {1} - Copy target instant spell, sorcery spell, activated ability, or triggered ability. You may choose new targets for the copy.\n+ {1} - Change the target of target spell or ability with a single target.',
            manaCost: '{R}{R}',
            manaValue: 2,
        });
        const disdainfulStroke = card('disdainful stroke', {
            typeLine: 'Instant',
            oracleText: 'Counter target spell with mana value 4 or greater.',
            manaCost: '{1}{U}',
            manaValue: 2,
        });
        const inevitableDefeat = card('inevitable defeat', {
            typeLine: 'Instant',
            oracleText: "This spell can't be countered.\nExile target nonland permanent. Its controller loses 3 life and you gain 3 life.",
            manaCost: '{1}{R}{W}{B}',
            manaValue: 4,
        });
        const abrade = card('abrade', {
            typeLine: 'Instant',
            oracleText: 'Choose one -\n* Abrade deals 3 damage to target creature.\n* Destroy target artifact.',
            manaCost: '{1}{R}',
            manaValue: 2,
        });

        const thunderOptions = analyzeCardValue(thunderMagic).castOptions;
        expect(thunderOptions.map(option => option.label)).toEqual(['Thunder', 'Thundara', 'Thundaga']);
        expect(thunderOptions[1].baseRows[0]).toMatchObject({
            condition: 'Thundara',
            cost: '{R}{3}',
            costSymbols: ['R', '3'],
            effect: 'Damage 4',
            value: 'Direct damage; Card -1',
        });

        const spreeOptions = analyzeCardValue(returnTheFavor).castOptions;
        expect(spreeOptions.map(option => option.label)).toEqual([
            'Copy spell or ability',
            'Change target',
            'Copy spell or ability + Change target',
        ]);
        expect(spreeOptions[0].baseRows[0]).toMatchObject({
            cost: '{R}{R}{1}',
            effect: 'Copy spell or ability',
            value: 'Stack interaction; Card -1',
        });
        expect(spreeOptions[2].baseRows[0]).toMatchObject({
            cost: '{R}{R}{1}{1}',
            effect: 'Copy spell or ability, Change target',
            value: 'Stack interaction; Card -1',
        });

        expect(analyzeCardValue(disdainfulStroke).castOptions[0].baseRows[0]).toMatchObject({
            effect: 'Counter spell MV 4+',
            value: 'Stack interaction; Card -1',
        });
        expect(analyzeCardValue(inevitableDefeat).castOptions[0].baseRows[0]).toMatchObject({
            effect: 'Exile nonland permanent, Drain 3',
            value: 'Battlefield removal; Life drain; Card -1',
        });
        expect(analyzeCardValue(abrade).castOptions.map(option => option.baseRows[0].effect)).toEqual([
            'Damage 3',
            'Destroy artifact',
        ]);
    });

    test('Feature: Value analysis parses 4c control card selection and split prepared spell faces.', () => {
        const consult = card('consult the star charts', {
            typeLine: 'Instant',
            oracleText: 'Kicker {1}{U} (You may pay an additional {1}{U} as you cast this spell.)\nLook at the top X cards of your library, where X is the number of lands you control. Put one of those cards into your hand. If this spell was kicked, put two of those cards into your hand instead. Put the rest on the bottom of your library in a random order.',
            manaCost: '{1}{U}',
            manaValue: 2,
        });
        const sanar = card('sanar, unfinished genius', {
            typeLine: 'Legendary Creature - Goblin Sorcerer // Sorcery',
            oracleText: "Sanar enters prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\n{T}: Create a Treasure token. Activate only if you've cast an instant or sorcery spell this turn.\nSearch your library for an instant or sorcery card, reveal it, put it into your hand, then shuffle.",
            manaCost: '{U}{R} // {3}{U}{R}',
            manaValue: 2,
            power: '0',
            toughness: '4',
        });
        const greatHall = card('great hall of the biblioplex', {
            typeLine: 'Land',
            oracleText: '{T}: Add {C}.\n{5}: If this land isn\'t a creature, it becomes a 2/4 Wizard creature with "Whenever you cast an instant or sorcery spell, this creature gets +1/+0 until end of turn."',
            manaCost: '',
            manaValue: 0,
        });

        const consultOptions = analyzeCardValue(consult).castOptions;
        expect(consultOptions[0].baseRows[0]).toMatchObject({
            condition: 'Cast',
            cost: '{1}{U}',
            effect: 'Look X, Select 1',
            value: 'Card quality improvement',
        });
        expect(consultOptions[1].baseRows[0]).toMatchObject({
            condition: 'Kicked',
            cost: '{1}{U}{1}{U}',
            effect: 'Look X, Select 2',
            value: 'Card quality improvement; Card +1',
        });

        const sanarValue = analyzeCardValue(sanar);
        expect(sanarValue.castOptions.map(option => option.label)).toContain('Spell face');
        expect(sanarValue.castOptions[0].baseRows[0]).toMatchObject({
            condition: 'Cast',
            cost: '{U}{R}',
            costSymbols: ['U', 'R'],
        });
        expect(sanarValue.castOptions.find(option => option.label === 'Spell face').baseRows[0]).toMatchObject({
            condition: 'Spell face',
            cost: '{3}{U}{R}',
            effect: 'Tutor instant/sorcery',
            speed: 'Sorcery',
            value: 'Tutor',
        });
        expect(sanarValue.activatedOptions).toContainEqual(expect.objectContaining({
            condition: "You've cast an instant or sorcery spell this turn",
            effect: 'Create Treasure',
            value: 'Treasure generation',
        }));

        const sanarWithHall = analyzeCardValue(sanar, [greatHall]);
        expect(sanarWithHall.castOptions.find(option => option.label === 'Cast').permanentOptions).toEqual([]);
        expect(sanarWithHall.castOptions.find(option => option.label === 'Spell face').permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'great hall of the biblioplex',
            effect: 'Combat pump +1/+0 UED',
            cost: '{5}',
        }));
    });

    test('Feature: Value analysis maps 4c control deck impacts from spells onto permanents in the same deck.', () => {
        const abrade = card('abrade', {
            typeLine: 'Instant',
            oracleText: 'Choose one -\n* Abrade deals 3 damage to target creature.\n* Destroy target artifact.',
            manaCost: '{1}{R}',
            manaValue: 2,
        });
        const greatHall = card('great hall of the biblioplex', {
            typeLine: 'Land',
            oracleText: '{T}: Add {C}.\n{5}: If this land isn\'t a creature, it becomes a 2/4 Wizard creature with "Whenever you cast an instant or sorcery spell, this creature gets +1/+0 until end of turn."',
            manaCost: '',
            manaValue: 0,
        }, 4);
        const sanar = card('sanar, unfinished genius', {
            typeLine: 'Legendary Creature - Goblin Sorcerer // Sorcery',
            oracleText: "Sanar enters prepared.\n{T}: Create a Treasure token. Activate only if you've cast an instant or sorcery spell this turn.\nSearch your library for an instant or sorcery card, reveal it, put it into your hand, then shuffle.",
            manaCost: '{U}{R} // {3}{U}{R}',
            manaValue: 2,
            power: '0',
            toughness: '4',
        }, 3);
        const coriMountain = card('cori mountain monastery', {
            typeLine: 'Land',
            oracleText: "This land enters tapped unless you control a Plains or an Island.\n{T}: Add {R}.\n{3}{R}, {T}: Exile the top card of your library. Until the end of your next turn, you may play that card.",
            manaCost: '',
            manaValue: 0,
        });
        const mistriseVillage = card('mistrise village', {
            typeLine: 'Land',
            oracleText: "This land enters tapped unless you control a Mountain or a Forest.\n{T}: Add {U}.\n{U}, {T}: The next spell you cast this turn can't be countered.",
            manaCost: '',
            manaValue: 0,
        });

        const abradeValue = analyzeCardValue(abrade, [greatHall, sanar]);
        const damageOption = abradeValue.castOptions.find(option => option.baseRows[0].effect === 'Damage 3');

        expect(damageOption.permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'great hall of the biblioplex',
            cost: '{5}',
            costSymbols: ['5'],
            effect: 'Combat pump +1/+0 UED',
            quantity: 4,
            value: 'Creature improvement',
        }));
        expect(damageOption.permanentOptions).toContainEqual(expect.objectContaining({
            condition: 'sanar, unfinished genius',
            cost: '{U}{R}',
            costSymbols: ['U', 'R'],
            actionCostSymbols: ['T'],
            effect: 'Enable Create Treasure',
            quantity: 3,
            value: 'Treasure generation',
        }));

        expect(analyzeCardValue(coriMountain).activatedOptions).toContainEqual(expect.objectContaining({
            cost: '{3}{R}, {T}',
            effect: 'Impulse draw',
            value: 'Card access',
        }));
        expect(analyzeCardValue(mistriseVillage).activatedOptions).toContainEqual(expect.objectContaining({
            cost: '{U}, {T}',
            effect: 'Protect next spell from counters',
            value: 'Stack protection',
        }));
    });
});
