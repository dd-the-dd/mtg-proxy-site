import { describe, expect, test } from 'vitest';
import {
    combatOutcome,
    summarizeCreatureInteractions,
    synergyInteractionDetail
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

    test('Feature: Creature combat analysis treats first strike plus deathtouch as lethal before normal damage.', () => {
        const firstStrikeTouch = card('knife fighter', {
            typeLine: 'Creature - Human Assassin',
            oracleText: 'First strike, deathtouch',
            power: '1',
            toughness: '1',
        });
        const largeCreature = card('large creature', {
            typeLine: 'Creature - Beast',
            oracleText: '',
            power: '8',
            toughness: '8',
        });

        expect(combatOutcome(firstStrikeTouch, largeCreature)).toBe('attackerSurvives');
    });

    test('Feature: Creature combat analysis lets double strike deal damage in both combat damage steps.', () => {
        const doubleStriker = card('two-step attacker', {
            typeLine: 'Creature - Human Warrior',
            oracleText: 'Double strike',
            power: '2',
            toughness: '4',
        });
        const defender = card('blocking creature', {
            typeLine: 'Creature - Beast',
            oracleText: '',
            power: '4',
            toughness: '4',
        });

        expect(combatOutcome(doubleStriker, defender)).toBe('bothDie');
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

    test('Feature: Token generators do not inherit generated creature token combat stats.', () => {
        const tokenMaker = card('raise the alarm', {
            typeLine: 'Instant',
            oracleText: 'Create two 1/1 white Soldier creature tokens.',
            relatedTokens: [
                {
                    name: 'soldier',
                    typeLine: 'Token Creature - Soldier',
                    oracleText: '',
                    power: '1',
                    toughness: '1',
                },
            ],
        });
        const enemyCreature = card('small attacker', {
            typeLine: 'Creature - Goblin',
            oracleText: '',
            power: '1',
            toughness: '1',
        });

        const summary = summarizeCreatureInteractions([tokenMaker], enemyCreature);

        expect(summary.combat.attacking.bothDie).toEqual([]);
        expect(summary.combat.defending.bothDie).toEqual([]);
    });

    test('Feature: Stormchaser-style cards separate synergy sources from synergy feeders.', () => {
        const stormchaserTalent = card("stormchaser's talent", {
            typeLine: 'Enchantment - Class',
            oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.\n{3}{U}: Level 2\nWhen this Class becomes level 2, return target instant or sorcery card from your graveyard to your hand.\n{5}{U}: Level 3\nWhenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
            manaCost: '{U}',
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
        });
        const otter = card('otter', {
            typeLine: 'Token Creature - Otter',
            oracleText: 'Prowess',
            power: '1',
            toughness: '1',
        });

        const sourceSummary = summarizeCreatureInteractions([stormchaserTalent], opt);
        const feederSummary = summarizeCreatureInteractions([opt], stormchaserTalent);
        const tokenFeederSummary = summarizeCreatureInteractions([opt], otter);

        expect(sourceSummary.synergy.combat.sources).toEqual([]);
        expect(sourceSummary.synergy.graveyardPlay.sources.map(item => item.name)).toEqual(["stormchaser's talent"]);
        expect(sourceSummary.synergy.creatureTokens.sources.map(item => item.name)).toEqual(["stormchaser's talent"]);
        expect(feederSummary.synergy.combat.feeders).toEqual([]);
        expect(tokenFeederSummary.synergy.combat.feeders.map(item => item.name)).toEqual(['opt']);
        expect(feederSummary.synergy.graveyardPlay.feeders.map(item => item.name)).toEqual(['opt']);
        expect(feederSummary.synergy.creatureTokens.feeders.map(item => item.name)).toEqual(['opt']);
        expect(synergyInteractionDetail(opt, otter, 'synergy.combat.feeders')).toBe('I:Combat pump +1/+1 UED cost 1');
        expect(synergyInteractionDetail(opt, stormchaserTalent, 'synergy.graveyardPlay.feeders')).toBe('S:Grave to hand cost 5');
        expect(synergyInteractionDetail(opt, stormchaserTalent, 'synergy.creatureTokens.feeders')).toBe('S:Token engine cost 11');
    });

    test('Feature: Izzet prowess combat triggers parse exact pump amounts from source text.', () => {
        const opt = card('opt', {
            typeLine: 'Instant',
            oracleText: 'Scry 1. Draw a card.',
            manaCost: '{U}',
        });
        const slickshot = card('slickshot show-off', {
            typeLine: 'Creature - Bird Wizard',
            oracleText: 'Flying, haste\nWhenever you cast a noncreature spell, this creature gets +2/+0 until end of turn.',
            manaCost: '{1}{R}',
            power: '1',
            toughness: '2',
        });
        const colorstormStallion = card('colorstorm stallion', {
            typeLine: 'Creature - Elemental Horse',
            oracleText: 'Ward {1}, haste\nOpus — Whenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn. If five or more mana was spent to cast that spell, create a token that\'s a copy of this creature.',
            manaCost: '{1}{U}{R}',
            power: '3',
            toughness: '3',
        });

        expect(synergyInteractionDetail(opt, slickshot, 'synergy.combat.feeders')).toBe('I:Combat pump +2/+0 UED cost 1');
        expect(synergyInteractionDetail(opt, colorstormStallion, 'synergy.combat.feeders')).toBe('I:Combat pump +1/+1 UED cost 1');
    });

    test('Feature: Bounce spells identify battlefield-to-hand and ETB recast synergies.', () => {
        const boomerang = card('boomerang', {
            typeLine: 'Instant',
            oracleText: "Return target permanent to its owner's hand.",
            manaCost: '{U}{U}',
        });
        const stormchaserTalent = card("stormchaser's talent", {
            typeLine: 'Enchantment - Class',
            oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.',
            manaCost: '{U}',
        });

        const summary = summarizeCreatureInteractions([boomerang], stormchaserTalent);

        expect(summary.synergy.battlefieldToHand.sources.map(item => item.name)).toEqual(['boomerang']);
        expect(summary.synergy.entersBattlefield.sources.map(item => item.name)).toEqual(['boomerang']);
        expect(synergyInteractionDetail(boomerang, stormchaserTalent, 'synergy.battlefieldToHand.sources')).toBe('I:Battlefield to hand draw cost 2');
        expect(synergyInteractionDetail(boomerang, stormchaserTalent, 'synergy.entersBattlefield.sources')).toBe('I:ETB recast cost 3');
    });

    test('Feature: Basic bounce creates zone movement for non-land permanents only.', () => {
        const boomerang = card('boomerang', {
            typeLine: 'Instant',
            oracleText: "Return target permanent to its owner's hand.",
            manaCost: '{U}{U}',
        });
        const arcaneSignet = card('arcane signet', {
            typeLine: 'Artifact',
            oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
            manaCost: '{2}',
        });
        const bear = card('bear cub', {
            typeLine: 'Creature - Bear',
            oracleText: '',
            manaCost: '{1}{G}',
            power: '2',
            toughness: '2',
        });
        const forest = card('forest', {
            typeLine: 'Basic Land - Forest',
            oracleText: '{T}: Add {G}.',
            manaCost: '',
        });

        expect(summarizeCreatureInteractions([boomerang], arcaneSignet).synergy.battlefieldToHand.sources.map(item => item.name)).toEqual(['boomerang']);
        expect(summarizeCreatureInteractions([boomerang], bear).synergy.battlefieldToHand.sources.map(item => item.name)).toEqual(['boomerang']);
        expect(summarizeCreatureInteractions([boomerang], forest).synergy.battlefieldToHand.sources).toEqual([]);
    });

    test('Feature: ETB lifegain passives identify creatures as feeders.', () => {
        const lumaret = card('bogwater lumaret', {
            typeLine: 'Creature - Frog',
            oracleText: 'Whenever this creature or another creature you control enters, you gain 1 life.',
            manaCost: '{B}{G}',
            power: '2',
            toughness: '2',
        });
        const rat = card('persistent specimen', {
            typeLine: 'Creature - Skeleton',
            oracleText: '',
            manaCost: '{B}',
            power: '1',
            toughness: '1',
        });

        const sourceSummary = summarizeCreatureInteractions([lumaret], rat);
        const feederSummary = summarizeCreatureInteractions([rat], lumaret);

        expect(sourceSummary.synergy.etbLifeGain.sources.map(item => item.name)).toEqual(['bogwater lumaret']);
        expect(feederSummary.synergy.etbLifeGain.feeders.map(item => item.name)).toEqual(['persistent specimen']);
        expect(synergyInteractionDetail(rat, lumaret, 'synergy.etbLifeGain.feeders')).toBe('S:ETB life gain +1 cost 1');
    });

    test('Feature: Creature death passives identify creatures as sacrifice-value feeders.', () => {
        const bloodArtist = card('blood artist', {
            typeLine: 'Creature - Vampire',
            oracleText: 'Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.',
            manaCost: '{1}{B}',
            power: '0',
            toughness: '1',
        });
        const pitilessPlunderer = card('pitiless plunderer', {
            typeLine: 'Creature - Human Pirate',
            oracleText: 'Whenever another creature you control dies, create a Treasure token.',
            manaCost: '{3}{B}',
            power: '1',
            toughness: '4',
        });
        const rat = card('persistent specimen', {
            typeLine: 'Creature - Skeleton',
            oracleText: '',
            manaCost: '{B}',
            power: '1',
            toughness: '1',
        });

        expect(summarizeCreatureInteractions([rat], bloodArtist).synergy.creatureDeathValue.feeders.map(item => item.name)).toEqual(['persistent specimen']);
        expect(summarizeCreatureInteractions([rat], pitilessPlunderer).synergy.creatureDeathValue.feeders.map(item => item.name)).toEqual(['persistent specimen']);
        expect(synergyInteractionDetail(rat, bloodArtist, 'synergy.creatureDeathValue.feeders')).toBe('S:Death drain +1 cost 1');
        expect(synergyInteractionDetail(rat, pitilessPlunderer, 'synergy.creatureDeathValue.feeders')).toBe('S:Death treasure cost 1');
    });
});
