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

    test('Feature: Token generators are analyzed in combat using generated creature token stats.', () => {
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

        expect(summary.combat.attacking.bothDie.map(item => item.name)).toEqual(['raise the alarm']);
        expect(summary.combat.defending.bothDie.map(item => item.name)).toEqual(['raise the alarm']);
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

        const sourceSummary = summarizeCreatureInteractions([stormchaserTalent], opt);
        const feederSummary = summarizeCreatureInteractions([opt], stormchaserTalent);

        expect(sourceSummary.synergy.combat.sources.map(item => item.name)).toEqual(["stormchaser's talent"]);
        expect(sourceSummary.synergy.graveyardPlay.sources.map(item => item.name)).toEqual(["stormchaser's talent"]);
        expect(sourceSummary.synergy.creatureTokens.sources.map(item => item.name)).toEqual(["stormchaser's talent"]);
        expect(feederSummary.synergy.combat.feeders.map(item => item.name)).toEqual(['opt']);
        expect(feederSummary.synergy.graveyardPlay.feeders.map(item => item.name)).toEqual(['opt']);
        expect(feederSummary.synergy.creatureTokens.feeders.map(item => item.name)).toEqual(['opt']);
        expect(synergyInteractionDetail(opt, stormchaserTalent, 'synergy.combat.feeders')).toBe('I:Feed 1+1 UED cost 1');
        expect(synergyInteractionDetail(opt, stormchaserTalent, 'synergy.graveyardPlay.feeders')).toBe('S:Grave to hand cost 5');
        expect(synergyInteractionDetail(opt, stormchaserTalent, 'synergy.creatureTokens.feeders')).toBe('S:Token engine cost 11');
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
});
