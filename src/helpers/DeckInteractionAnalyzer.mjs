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
    const selectedCard = selected(card);
    if (selectedCard.manaCost !== undefined) {
        return selectedCard.manaCost;
    }

    return Number.isFinite(Number(selectedCard.manaValue))
        ? `{${Math.max(0, Math.floor(Number(selectedCard.manaValue)))}}`
        : '';
}

function manaCostValue(cost) {
    let total = 0;
    const matches = cost.matchAll(/\{([^}]+)\}/g);

    for (const match of matches) {
        const symbol = match[1];
        if (/^\d+$/.test(symbol)) {
            total += parseInt(symbol, 10);
        } else if (!/^X$/i.test(symbol)) {
            total += 1;
        }
    }

    return total;
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

function isPermanentCard(card) {
    const typeLine = typeLineOf(card);
    return /\b(?:Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/i.test(typeLine);
}

function isNonLandPermanentCard(card) {
    return isPermanentCard(card) && !/\bLand\b/i.test(typeLineOf(card));
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
        battlefieldToHand: emptySynergySummary(),
        entersBattlefield: emptySynergySummary(),
        etbLifeGain: emptySynergySummary(),
        creatureDeathValue: emptySynergySummary(),
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

    return [];
}

function pushOnce(cards, card) {
    if (!cards.includes(card)) {
        cards.push(card);
    }
}

function combatPump(card) {
    const oracleText = textOf(card);
    const pumpMatch = /whenever you cast (?:a|an) (noncreature|instant or sorcery) spell, this creature gets \+(\d+)\/\+?(\d+) until end of turn/i.exec(oracleText);
    if (pumpMatch) {
        return {
            power: parseInt(pumpMatch[2], 10),
            toughness: parseInt(pumpMatch[3], 10),
            trigger: pumpMatch[1].toLowerCase() === 'instant or sorcery' ? 'instantOrSorcery' : 'nonCreature',
        };
    }

    if (isCreatureCard(card) && /\bProwess\b/i.test(oracleText)) {
        return {
            power: 1,
            toughness: 1,
            trigger: 'nonCreature',
        };
    }

    return null;
}

function combatSynergyApplies(source, feeder) {
    const pump = combatPump(source);
    if (!pump) {
        return false;
    }

    return pump.trigger === 'instantOrSorcery'
        ? isInstantOrSorcery(feeder)
        : isNonCreatureNonLandSpell(feeder);
}

function isCombatSynergySource(card) {
    return combatPump(card) !== null;
}

function isGraveyardPlaySynergySource(card) {
    return /return target instant or sorcery card from your graveyard to your hand/i.test(textOf(card));
}

function isCreatureTokenSynergySource(card) {
    return /whenever you cast an instant or sorcery spell, create/i.test(textOf(card)) ||
        /if five or more mana was spent to cast that spell, create a token/i.test(textOf(card));
}

function hasManaSpentTokenCopyThreshold(card) {
    return /if five or more mana was spent to cast that spell, create a token/i.test(textOf(card));
}

function isClassCard(card) {
    return /\bClass\b/i.test(typeLineOf(card));
}

function isBattlefieldToHandSynergySource(card) {
    return /return target permanent to (?:its|their|his|her|that permanent's) owner's hand/i.test(textOf(card));
}

function isEntersBattlefieldSynergyTarget(card) {
    return /\b(?:when|whenever) (?:this|[^.]+) enters\b/i.test(textOf(card));
}

function isCreatureEnterLifeGainSource(card) {
    return /whenever (?:this creature or another creature you control|another creature you control|a creature you control) enters\b[^.]*you gain (\d+) life/i.test(textOf(card));
}

function creatureEnterLifeGainAmount(card) {
    const match = /whenever (?:this creature or another creature you control|another creature you control|a creature you control) enters\b[^.]*you gain (\d+) life/i.exec(textOf(card));
    return match ? parseInt(match[1], 10) : 1;
}

function createsCreatureToken(card) {
    return /\bcreate\b[^.]*\b\d+\/\d+\b[^.]*\bcreature tokens?\b/i.test(textOf(card));
}

function feedsCreatureEnter(card) {
    return isCreatureCard(card) || createsCreatureToken(card);
}

function isCreatureDeathValueSource(card) {
    const oracleText = textOf(card);
    return /whenever (?:this creature or another creature|another creature(?: you control)?|a creature|one or more creatures)[^.]*\bdies\b/i.test(oracleText) ||
        /for each creature that died this turn/i.test(oracleText);
}

function creatureDeathEffect(source) {
    const oracleText = textOf(source);
    const drain = /loses (\d+) life and you gain \1 life/i.exec(oracleText);
    if (drain) {
        return {
            detail: `Death drain +${drain[1]}`,
            value: 'lifeDrain',
        };
    }

    if (/create (?:a )?Treasure token/i.test(oracleText)) {
        return {
            detail: 'Death treasure',
            value: 'treasure',
        };
    }

    const damage = /deals? (\d+) damage/i.exec(oracleText);
    if (damage) {
        return {
            detail: `Death ping +${damage[1]}`,
            value: 'damage',
        };
    }

    if (/draw a card/i.test(oracleText)) {
        return {
            detail: 'Death draw',
            value: 'cardDraw',
        };
    }

    return {
        detail: 'Death payoff',
        value: 'payoff',
    };
}

function addSynergyMatches(summary, card, relatedCard) {
    if (combatSynergyApplies(card, relatedCard)) {
        pushOnce(summary.synergy.combat.sources, card);
    }

    if (combatSynergyApplies(relatedCard, card)) {
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

    if (isBattlefieldToHandSynergySource(card) && isNonLandPermanentCard(relatedCard)) {
        pushOnce(summary.synergy.battlefieldToHand.sources, card);
    }

    if (isBattlefieldToHandSynergySource(relatedCard) && isNonLandPermanentCard(card)) {
        pushOnce(summary.synergy.battlefieldToHand.feeders, card);
    }

    if (isBattlefieldToHandSynergySource(card) && isNonLandPermanentCard(relatedCard) && isEntersBattlefieldSynergyTarget(relatedCard)) {
        pushOnce(summary.synergy.entersBattlefield.sources, card);
    }

    if (isBattlefieldToHandSynergySource(relatedCard) && isNonLandPermanentCard(card) && isEntersBattlefieldSynergyTarget(card)) {
        pushOnce(summary.synergy.entersBattlefield.feeders, card);
    }

    if (isCreatureEnterLifeGainSource(card) && feedsCreatureEnter(relatedCard)) {
        pushOnce(summary.synergy.etbLifeGain.sources, card);
    }

    if (isCreatureEnterLifeGainSource(relatedCard) && feedsCreatureEnter(card)) {
        pushOnce(summary.synergy.etbLifeGain.feeders, card);
    }

    if (isCreatureDeathValueSource(card) && isCreatureCard(relatedCard)) {
        pushOnce(summary.synergy.creatureDeathValue.sources, card);
    }

    if (isCreatureDeathValueSource(relatedCard) && isCreatureCard(card)) {
        pushOnce(summary.synergy.creatureDeathValue.feeders, card);
    }
}

export function synergyTriggerCost(card, relatedCard, categoryKey) {
    return /\.sources$/.test(categoryKey)
        ? manaCostOf(relatedCard)
        : manaCostOf(card);
}

function classLevelCost(card, targetLevel) {
    const selectedCard = selected(card);
    let total = manaCostValue(manaCostOf(card));
    const levelCosts = [...textOf(card).matchAll(/((?:\{[^}]+\})+):\s*Level\s+(\d+)/gi)]
        .map(match => {
            return {
                cost: manaCostValue(match[1]),
                level: parseInt(match[2], 10),
            };
        })
        .sort((a, b) => a.level - b.level);

    if (!/\bClass\b/i.test(selectedCard.typeLine ?? '') || levelCosts.length === 0) {
        return total;
    }

    for (const levelCost of levelCosts) {
        if (levelCost.level <= targetLevel) {
            total += levelCost.cost;
        }
    }

    return total;
}

function synergySourceAndFeeder(card, relatedCard, categoryKey) {
    return /\.feeders$/.test(categoryKey)
        ? { source: relatedCard, feeder: card }
        : { source: card, feeder: relatedCard };
}

export function synergyInteractionDetail(card, relatedCard, categoryKey) {
    const { source, feeder } = synergySourceAndFeeder(card, relatedCard, categoryKey);

    if (/^synergy\.combat\./.test(categoryKey)) {
        const speed = isClassCard(source) || spellSpeed(feeder) !== 'instant' ? 'S' : 'I';
        const pump = combatPump(source) ?? { power: 1, toughness: 1 };
        return `${speed}:Combat pump +${pump.power}/+${pump.toughness} UED cost ${manaCostValue(manaCostOf(feeder))}`;
    }

    if (/^synergy\.graveyardPlay\./.test(categoryKey)) {
        return `S:Grave to hand cost ${classLevelCost(source, 2)}`;
    }

    if (/^synergy\.creatureTokens\./.test(categoryKey)) {
        if (hasManaSpentTokenCopyThreshold(source)) {
            return 'S:Copy token cost 5';
        }

        return `S:Token engine cost ${classLevelCost(source, 3)}`;
    }

    if (/^synergy\.battlefieldToHand\./.test(categoryKey)) {
        const speed = spellSpeed(source) === 'instant' ? 'I' : 'S';
        return `${speed}:Battlefield to hand draw cost ${manaCostValue(manaCostOf(source))}`;
    }

    if (/^synergy\.entersBattlefield\./.test(categoryKey)) {
        const speed = spellSpeed(source) === 'instant' ? 'I' : 'S';
        return `${speed}:ETB recast cost ${manaCostValue(manaCostOf(source)) + manaCostValue(manaCostOf(feeder))}`;
    }

    if (/^synergy\.etbLifeGain\./.test(categoryKey)) {
        const speed = spellSpeed(feeder) === 'instant' ? 'I' : 'S';
        return `${speed}:ETB life gain +${creatureEnterLifeGainAmount(source)} cost ${manaCostValue(manaCostOf(feeder))}`;
    }

    if (/^synergy\.creatureDeathValue\./.test(categoryKey)) {
        const speed = spellSpeed(feeder) === 'instant' ? 'I' : 'S';
        return `${speed}:${creatureDeathEffect(source).detail} cost ${manaCostValue(manaCostOf(feeder))}`;
    }

    return '';
}

export function synergyActionCost(card, relatedCard, categoryKey) {
    const { source, feeder } = synergySourceAndFeeder(card, relatedCard, categoryKey);

    if (/^synergy\.combat\./.test(categoryKey)) {
        return manaCostValue(manaCostOf(feeder));
    }

    if (/^synergy\.graveyardPlay\./.test(categoryKey)) {
        return classLevelCost(source, 2);
    }

    if (/^synergy\.creatureTokens\./.test(categoryKey)) {
        if (hasManaSpentTokenCopyThreshold(source)) {
            return 5;
        }

        return classLevelCost(source, 3);
    }

    if (/^synergy\.battlefieldToHand\./.test(categoryKey)) {
        return manaCostValue(manaCostOf(source));
    }

    if (/^synergy\.entersBattlefield\./.test(categoryKey)) {
        return manaCostValue(manaCostOf(source)) + manaCostValue(manaCostOf(feeder));
    }

    if (/^synergy\.etbLifeGain\./.test(categoryKey)) {
        return manaCostValue(manaCostOf(feeder));
    }

    if (/^synergy\.creatureDeathValue\./.test(categoryKey)) {
        return manaCostValue(manaCostOf(feeder));
    }

    return null;
}

export function synergyValueCategory(card, relatedCard, categoryKey) {
    const { source } = synergySourceAndFeeder(card, relatedCard, categoryKey);

    if (/^synergy\.creatureDeathValue\./.test(categoryKey)) {
        return creatureDeathEffect(source).value;
    }

    return '';
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
