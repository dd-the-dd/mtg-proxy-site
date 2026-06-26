const characteristicCache = new WeakMap();

function selected(card) {
    return card.selectedOption ?? card;
}

function textOf(card) {
    return selected(card).oracleText ?? '';
}

function typeLineOf(card) {
    return selected(card).typeLine ?? '';
}

function manaCostOf(card) {
    return selected(card).manaCost ?? '';
}

function statValue(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function keywordsOf(card) {
    const selectedCard = selected(card);
    const listedKeywords = selectedCard.keywords ?? [];
    const textKeywords = [
        'deathtouch',
        'defender',
        'double strike',
        'first strike',
        'flying',
        'indestructible',
        'menace',
        'reach',
        'trample',
        'vigilance',
    ].filter(keyword => {
        return new RegExp(`\\b${keyword}\\b`, 'i').test(textOf(card));
    });

    return new Set([...listedKeywords, ...textKeywords].map(keyword => keyword.toLowerCase()));
}

function hasKeyword(card, keyword) {
    return creatureCharacteristics(card).keywords.has(keyword.toLowerCase());
}

export function isCreatureCard(card) {
    return /\bCreature\b/i.test(typeLineOf(card));
}

function isInstantOrSorcery(card) {
    return /\b(?:Instant|Sorcery)\b/i.test(typeLineOf(card));
}

function isNonCreatureNonLandSpell(card) {
    const typeLine = typeLineOf(card);
    return typeLine !== '' &&
        !/\bCreature\b/i.test(typeLine) &&
        !/\bLand\b/i.test(typeLine);
}

export function creatureStats(card) {
    return {
        power: statValue(selected(card).power),
        toughness: statValue(selected(card).toughness),
    };
}

export function creatureCharacteristics(card) {
    const selectedCard = selected(card);

    if (characteristicCache.has(selectedCard)) {
        return characteristicCache.get(selectedCard);
    }

    const savedCharacteristics = selectedCard.analysisCharacteristics;
    const characteristics = savedCharacteristics
        ? {
            ...savedCharacteristics,
            keywords: new Set(Array.isArray(savedCharacteristics.keywords) ? savedCharacteristics.keywords : []),
        }
        : {
            isCreature: isCreatureCard(card),
            keywords: keywordsOf(card),
            power: statValue(selectedCard.power),
            toughness: statValue(selectedCard.toughness),
            unblockable: /can't be blocked|can’t be blocked|unblockable/i.test(textOf(card)),
        };

    characteristicCache.set(selectedCard, characteristics);
    return characteristics;
}

export function cardAnalysisCharacteristics(card) {
    const characteristics = creatureCharacteristics(card);

    return {
        ...characteristics,
        keywords: [...characteristics.keywords],
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
    const attackerCharacteristics = creatureCharacteristics(attacker);
    const defenderCharacteristics = creatureCharacteristics(defender);
    const attackerFlying = attackerCharacteristics.keywords.has('flying');
    const attackerMenace = attackerCharacteristics.keywords.has('menace');
    const defenderFlying = defenderCharacteristics.keywords.has('flying');
    const defenderReach = defenderCharacteristics.keywords.has('reach');

    if (attackerCharacteristics.unblockable || attackerMenace) {
        return false;
    }

    return !attackerFlying || defenderFlying || defenderReach;
}

function dealsLethalDamage(attackerCharacteristics, defenderCharacteristics, assignedDamage) {
    if (assignedDamage <= 0) {
        return false;
    }

    if (defenderCharacteristics.keywords.has('indestructible')) {
        return false;
    }

    return attackerCharacteristics.keywords.has('deathtouch') ||
        assignedDamage >= defenderCharacteristics.toughness;
}

function canAssignFirstStrikeDamage(characteristics) {
    return characteristics.keywords.has('first strike') ||
        characteristics.keywords.has('double strike');
}

function canAssignNormalDamage(characteristics) {
    return characteristics.keywords.has('double strike') ||
        (!characteristics.keywords.has('first strike') && !characteristics.keywords.has('double strike'));
}

export function combatOutcome(attacker, defender) {
    if (!isCreatureCard(attacker) || !isCreatureCard(defender)) {
        return null;
    }

    if (!canBlock(attacker, defender)) {
        return 'damageOnPlayer';
    }

    const attackerStats = creatureCharacteristics(attacker);
    const defenderStats = creatureCharacteristics(defender);
    if (
        attackerStats.power === null ||
        attackerStats.toughness === null ||
        defenderStats.power === null ||
        defenderStats.toughness === null
    ) {
        return 'unknown';
    }

    let attackerDamage = 0;
    let defenderDamage = 0;
    let attackerDies = false;
    let defenderDies = false;
    const hasFirstStrikeStep = canAssignFirstStrikeDamage(attackerStats) ||
        canAssignFirstStrikeDamage(defenderStats);

    if (hasFirstStrikeStep) {
        const attackerFirstStrikeDamage = canAssignFirstStrikeDamage(attackerStats)
            ? attackerStats.power
            : 0;
        const defenderFirstStrikeDamage = canAssignFirstStrikeDamage(defenderStats)
            ? defenderStats.power
            : 0;

        attackerDamage += defenderFirstStrikeDamage;
        defenderDamage += attackerFirstStrikeDamage;
        attackerDies = dealsLethalDamage(defenderStats, attackerStats, attackerDamage);
        defenderDies = dealsLethalDamage(attackerStats, defenderStats, defenderDamage);
    }

    if (!attackerDies && !defenderDies) {
        const attackerNormalDamage = canAssignNormalDamage(attackerStats)
            ? attackerStats.power
            : 0;
        const defenderNormalDamage = canAssignNormalDamage(defenderStats)
            ? defenderStats.power
            : 0;

        attackerDamage += defenderNormalDamage;
        defenderDamage += attackerNormalDamage;
        attackerDies = dealsLethalDamage(defenderStats, attackerStats, attackerDamage);
        defenderDies = dealsLethalDamage(attackerStats, defenderStats, defenderDamage);
    }

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

function emptySynergySummary() {
    return {
        sources: [],
        feeders: [],
    };
}

function createSynergySummary() {
    return {
        combat: emptySynergySummary(),
        graveyardPlay: emptySynergySummary(),
        creatureTokens: emptySynergySummary(),
    };
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

function combatRepresentatives(card) {
    if (isCreatureCard(card)) {
        return [card];
    }

    return (selected(card).relatedTokens ?? [])
        .filter(token => /\bCreature\b/i.test(token.typeLine ?? ''))
        .map(token => {
            return {
                name: card.name,
                quantity: card.quantity,
                selectedOption: token,
            };
        });
}

function pushOnce(cards, card) {
    if (!cards.includes(card)) {
        cards.push(card);
    }
}

function tokenHasProwess(card) {
    return (selected(card).relatedTokens ?? []).some(token => {
        return /\bCreature\b/i.test(token.typeLine ?? '') &&
            /\bProwess\b/i.test(token.oracleText ?? '');
    });
}

function isCombatSynergySource(card) {
    return /\bProwess\b/i.test(textOf(card)) || tokenHasProwess(card);
}

function isGraveyardPlaySynergySource(card) {
    return /return target instant or sorcery card from your graveyard to your hand/i.test(textOf(card));
}

function isCreatureTokenSynergySource(card) {
    return /whenever you cast an instant or sorcery spell, create/i.test(textOf(card));
}

function addSynergyMatches(summary, card, relatedCard) {
    if (isCombatSynergySource(card) && isNonCreatureNonLandSpell(relatedCard)) {
        pushOnce(summary.synergy.combat.sources, card);
    }

    if (isCombatSynergySource(relatedCard) && isNonCreatureNonLandSpell(card)) {
        pushOnce(summary.synergy.combat.feeders, card);
    }

    if (isGraveyardPlaySynergySource(card) && isInstantOrSorcery(relatedCard)) {
        pushOnce(summary.synergy.graveyardPlay.sources, card);
    }

    if (isGraveyardPlaySynergySource(relatedCard) && isInstantOrSorcery(card)) {
        pushOnce(summary.synergy.graveyardPlay.feeders, card);
    }

    if (isCreatureTokenSynergySource(card) && isInstantOrSorcery(relatedCard)) {
        pushOnce(summary.synergy.creatureTokens.sources, card);
    }

    if (isCreatureTokenSynergySource(relatedCard) && isInstantOrSorcery(card)) {
        pushOnce(summary.synergy.creatureTokens.feeders, card);
    }
}

export function synergyTriggerCost(card, relatedCard, categoryKey) {
    return /\.sources$/.test(categoryKey)
        ? manaCostOf(relatedCard)
        : manaCostOf(card);
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
        synergy: createSynergySummary(),
    };

    for (const card of evaluatedCards) {
        if (canDestroyCreatureWithSpell(card, enemyCreature)) {
            const speed = spellSpeed(card);
            summary[speed === 'instant' ? 'instantRemoval' : 'sorceryRemoval'].push(card);
        }

        for (const combatCard of combatRepresentatives(card)) {
            const attackingOutcome = combatOutcome(combatCard, enemyCreature);
            if (attackingOutcome) {
                pushOnce(summary.combat.attacking[attackingOutcome], card);
            }

            const defendingOutcome = combatOutcome(enemyCreature, combatCard);
            if (defendingOutcome) {
                pushOnce(summary.combat.defending[defendingOutcome], card);
            }
        }

        if (hasCreatureSynergy(card)) {
            summary.synergies.push(card);
        }

        addSynergyMatches(summary, card, enemyCreature);
    }

    return summary;
}
