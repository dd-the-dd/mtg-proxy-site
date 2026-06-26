function selected(card) {
    return card.selectedOption ?? card;
}

function textOf(card) {
    return selected(card).oracleText ?? '';
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function statValue(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function hasKeyword(card, keyword) {
    return new RegExp(`\\b${keyword}\\b`, 'i').test(textOf(card));
}

export function isCreatureCard(card) {
    return /\bCreature\b/i.test(typeLineOf(card));
}

export function creatureStats(card) {
    return {
        power: statValue(selected(card).power),
        toughness: statValue(selected(card).toughness),
    };
}

export function spellSpeed(card) {
    const typeLine = typeLineOf(card);

    if (/\bInstant\b/i.test(typeLine)) {
        return 'instant';
    }

    if (/\bSorcery\b/i.test(typeLine)) {
        return 'sorcery';
    }

    return null;
}

export function damageAmount(card) {
    const oracleText = textOf(card);
    const match = /deals? (\d+) damage to (?:any target|target (?:creature|creature or planeswalker|player or planeswalker|opponent|player))/i.exec(oracleText);
    return match ? parseInt(match[1], 10) : 0;
}

export function canDestroyCreatureWithSpell(card, creature) {
    const speed = spellSpeed(card);
    if (!speed) {
        return false;
    }

    const oracleText = textOf(card);
    if (/(destroy|exile) target (?:nonland )?(?:creature|permanent)/i.test(oracleText)) {
        return true;
    }

    const { toughness } = creatureStats(creature);
    return toughness !== null && damageAmount(card) >= toughness;
}

export function canBlock(attacker, defender) {
    const attackerFlying = hasKeyword(attacker, 'flying');
    const defenderFlying = hasKeyword(defender, 'flying');
    const defenderReach = hasKeyword(defender, 'reach');

    return !attackerFlying || defenderFlying || defenderReach;
}

export function combatOutcome(attacker, defender) {
    if (!isCreatureCard(attacker) || !isCreatureCard(defender)) {
        return null;
    }

    if (!canBlock(attacker, defender)) {
        return 'damageOnPlayer';
    }

    const attackerStats = creatureStats(attacker);
    const defenderStats = creatureStats(defender);
    if (
        attackerStats.power === null ||
        attackerStats.toughness === null ||
        defenderStats.power === null ||
        defenderStats.toughness === null
    ) {
        return 'unknown';
    }

    const attackerDies = defenderStats.power >= attackerStats.toughness;
    const defenderDies = attackerStats.power >= defenderStats.toughness;

    if (attackerDies && defenderDies) {
        return 'bothDie';
    }

    if (attackerDies) {
        return 'defenderSurvives';
    }

    if (defenderDies) {
        return 'attackerSurvives';
    }

    return 'bothSurvive';
}

export function hasCreatureSynergy(card) {
    const oracleText = textOf(card);
    return /target creature|creatures? you control|whenever (?:a|another|one or more) creatures?|creature spell/i.test(oracleText);
}

function emptyCombatSummary() {
    return {
        bothSurvive: [],
        bothDie: [],
        defenderSurvives: [],
        attackerSurvives: [],
        damageOnPlayer: [],
        unknown: [],
    };
}

export function summarizeCreatureInteractions(evaluatedCards, enemyCreature) {
    const summary = {
        instantRemoval: [],
        sorceryRemoval: [],
        combat: {
            attacking: emptyCombatSummary(),
            defending: emptyCombatSummary(),
        },
        synergies: [],
    };

    for (const card of evaluatedCards) {
        if (canDestroyCreatureWithSpell(card, enemyCreature)) {
            const speed = spellSpeed(card);
            summary[speed === 'instant' ? 'instantRemoval' : 'sorceryRemoval'].push(card);
        }

        if (isCreatureCard(card)) {
            const attackingOutcome = combatOutcome(card, enemyCreature);
            if (attackingOutcome) {
                summary.combat.attacking[attackingOutcome].push(card);
            }

            const defendingOutcome = combatOutcome(enemyCreature, card);
            if (defendingOutcome) {
                summary.combat.defending[defendingOutcome].push(card);
            }
        }

        if (hasCreatureSynergy(card)) {
            summary.synergies.push(card);
        }
    }

    return summary;
}
