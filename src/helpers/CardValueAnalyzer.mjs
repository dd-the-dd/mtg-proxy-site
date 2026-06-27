import {
    synergyActionCost,
    synergyInteractionDetail,
    summarizeCreatureInteractions
} from './DeckInteractionAnalyzer.mjs';

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

function manaSymbols(cost) {
    return [...cost.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
}

function numericCostSymbols(cost) {
    return cost === '' ? [] : [cost];
}

function addManaCosts(...costs) {
    return costs.filter(Boolean).join('');
}

function manaCostValue(cost) {
    return manaSymbols(cost).reduce((total, symbol) => {
        if (/^\d+$/.test(symbol)) {
            return total + parseInt(symbol, 10);
        }

        return /^X$/i.test(symbol) ? total : total + 1;
    }, 0);
}

function numberWordValue(value) {
    const words = {
        one: 1,
        two: 2,
        three: 3,
        four: 4,
        five: 5,
        six: 6,
        seven: 7,
        eight: 8,
        nine: 9,
        ten: 10,
    };

    return /^\d+$/.test(value) ? parseInt(value, 10) : words[value.toLowerCase()];
}

function drawCount(card) {
    const matches = textOf(card).match(/\bdraw (?:a card|one card|\d+ cards?)\b/gi) ?? [];
    return matches.reduce((total, match) => {
        const number = /\d+/.exec(match)?.[0];
        return total + (number ? parseInt(number, 10) : 1);
    }, 0);
}

function qualityValues(card) {
    const text = textOf(card);
    const values = [];
    const scry = /\bscry (\d+)/i.exec(text);
    if (scry) {
        values.push(`Scry ${scry[1]}`);
    }

    const surveil = /\bsurveil (\d+)/i.exec(text);
    if (surveil) {
        values.push(`Surveil ${surveil[1]}`);
    }

    const look = /\blook at the top (\d+|one|two|three|four|five|six|seven|eight|nine|ten) cards?/i.exec(text);
    if (look) {
        values.push(`Look ${numberWordValue(look[1])}`);
    }

    return values;
}

function castSpeed(card) {
    if (/\bflash\b/i.test(textOf(card))) {
        return 'Flash';
    }

    return /\bInstant\b/i.test(typeLineOf(card)) ? 'Instant' : 'Sorcery';
}

function isCastableSpell(card) {
    return !/\bLand\b/i.test(typeLineOf(card)) && manaCostOf(card) !== '';
}

function kickerCosts(card) {
    return [...textOf(card).matchAll(/\bKicker(?:\s*[—-])?\s*((?:\{[^}]+\})+)/gi)]
        .map(match => match[1]);
}

function plotCosts(card) {
    return [...textOf(card).matchAll(/\bPlot\s*((?:\{[^}]+\})+)/gi)]
        .map(match => match[1]);
}

function synergyCategories() {
    return [
        'synergy.combat.feeders',
        'synergy.graveyardPlay.feeders',
        'synergy.creatureTokens.feeders',
        'synergy.battlefieldToHand.sources',
        'synergy.entersBattlefield.sources',
    ];
}

function hasSynergy(summary, key) {
    return key.split('.').reduce((value, part) => value?.[part], summary)?.length > 0;
}

function synergyKind(key) {
    if (/graveyardPlay|battlefieldToHand|entersBattlefield/.test(key)) {
        return 'zone';
    }

    if (/\.feeders$/.test(key)) {
        return 'permanent';
    }

    return 'bonus';
}

function synergyCondition(key, card, relatedCard) {
    if (/creatureTokens/.test(key) && /five or more mana was spent/i.test(textOf(relatedCard))) {
        return `${relatedCard.name} threshold`;
    }

    if (/\.feeders$/.test(key) && /\bClass\b/i.test(typeLineOf(relatedCard))) {
        if (/graveyardPlay/.test(key)) {
            return `${relatedCard.name} class 2`;
        }

        if (/creatureTokens/.test(key)) {
            return `${relatedCard.name} class 3`;
        }

        return `${relatedCard.name} class 1`;
    }

    if (/\.feeders$/.test(key)) {
        return relatedCard.name;
    }

    if (/graveyardPlay/.test(key)) {
        return 'Class L2 unlocked';
    }

    if (/creatureTokens/.test(key)) {
        return 'Class L3 unlocked';
    }

    const actionCost = synergyActionCost(card, relatedCard, key);
    return actionCost === null ? '' : `Action ${actionCost}`;
}

function stateValue(handDelta) {
    if (handDelta === 0) {
        return '';
    }

    return `Card ${handDelta > 0 ? `+${handDelta}` : handDelta}`;
}

function damageValue(card, kicked = false) {
    const text = textOf(card);
    const kickedDamage = /if this spell was kicked, it deals (\d+) damage instead/i.exec(text);
    if (kicked && kickedDamage) {
        return `Damage ${kickedDamage[1]}`;
    }

    const baseDamage = /deals? (\d+) damage to (?:any target|target (?:creature|creature or planeswalker|player or planeswalker|opponent|player))/i.exec(text);
    return baseDamage ? `Damage ${baseDamage[1]}` : '';
}

function castEffectText(card, drawn, option = {}) {
    if (option.plotted) {
        return 'Exile for later cast';
    }

    const effects = [...qualityValues(card)];
    if (drawn > 0) {
        effects.push(`Draw ${drawn}`);
    }

    const damage = damageValue(card, option.kicked);
    if (damage) {
        effects.push(damage);
    }

    return effects.join(', ');
}

function castValueText(card, handValue, option = {}) {
    if (option.plotted) {
        return ['Delayed cast option', handValue].filter(Boolean).join('; ');
    }

    if (qualityValues(card).length > 0) {
        return 'Card quality improvement';
    }

    if (damageValue(card, option.kicked)) {
        return ['Direct damage', handValue].filter(Boolean).join('; ');
    }

    return handValue;
}

function detailSpeed(detail) {
    return /^I:/.test(detail) ? 'Instant' : 'Sorcery';
}

function synergySpeed(key, relatedCard, detail) {
    if (/\.feeders$/.test(key)) {
        return castSpeed(relatedCard);
    }

    return detailSpeed(detail);
}

function detailEffect(detail) {
    return detail.replace(/^[IS]:/, '').replace(/\scost \d+$/, '');
}

function isThresholdTokenCopyDetail(detail) {
    return /Copy token cost 5/.test(detail);
}

function synergyValueText(key) {
    if (/^synergy\.combat\./.test(key)) {
        return 'Creature improvement';
    }

    if (/^synergy\.graveyardPlay\./.test(key)) {
        return 'Card recursion';
    }

    if (/^synergy\.creatureTokens\./.test(key)) {
        return 'Creature token generation';
    }

    if (/^synergy\.battlefieldToHand\./.test(key)) {
        return 'Battlefield reset';
    }

    if (/^synergy\.entersBattlefield\./.test(key)) {
        return 'ETB reuse';
    }

    return '';
}

function castOptionsForCard(card, drawn, handValue) {
    const baseCost = manaCostOf(card);
    const baseOption = {
        label: 'Cast',
        cost: baseCost,
        costValue: manaCostValue(baseCost),
        costSymbols: manaSymbols(baseCost),
        kicked: false,
    };

    const kickedOptions = kickerCosts(card).map(kickerCost => {
        const cost = addManaCosts(baseCost, kickerCost);
        return {
            label: 'Kicked',
            cost,
            costValue: manaCostValue(cost),
            costSymbols: manaSymbols(cost),
            kicked: true,
        };
    });
    const plotOptions = plotCosts(card).map(plotCost => {
        return {
            label: 'Plot',
            cost: plotCost,
            costValue: manaCostValue(plotCost),
            costSymbols: manaSymbols(plotCost),
            kicked: false,
            plotted: true,
        };
    });

    return [baseOption, ...kickedOptions, ...plotOptions].map(option => {
        return {
            ...option,
            baseRows: [
                {
                    condition: option.label,
                    cost: option.cost,
                    costSymbols: option.costSymbols,
                    effect: castEffectText(card, drawn, option),
                    speed: castSpeed(card),
                    value: castValueText(card, handValue, option),
                },
            ],
        };
    });
}

export function analyzeCardValue(card, relatedCards = []) {
    if (!isCastableSpell(card)) {
        return {
            castOptions: [],
        };
    }

    const drawn = drawCount(card);
    const handDelta = -1 + drawn;
    const values = [];
    const handValue = stateValue(handDelta);
    if (handValue !== '') {
        values.push({ label: 'State', value: handValue });
    }

    for (const quality of qualityValues(card)) {
        values.push({ label: 'Effect', value: quality });
    }

    const castOptions = castOptionsForCard(card, drawn, handValue).map(option => {
        return {
            label: option.label,
            cost: option.cost,
            costValue: option.costValue,
            speed: castSpeed(card),
            symbols: option.costSymbols,
            baseRows: option.baseRows,
            values,
            bonuses: [],
            permanentOptions: [],
            zoneChanges: [],
        };
    });
    const zoneOptions = [];
    const seenZoneOptions = new Set();

    for (const relatedCard of relatedCards) {
        const summary = summarizeCreatureInteractions([card], relatedCard);
        for (const key of synergyCategories()) {
            if (!hasSynergy(summary, key)) {
                continue;
            }

            const detail = synergyInteractionDetail(card, relatedCard, key);
            const cost = String(synergyActionCost(card, relatedCard, key) ?? '');
            const entry = {
                condition: synergyCondition(key, card, relatedCard),
                cost,
                costSymbols: numericCostSymbols(cost),
                detail,
                effect: detailEffect(detail),
                quantity: relatedCard.quantity ?? 1,
                source: relatedCard.name,
                sourceLine: `x${relatedCard.quantity ?? 1}`,
                speed: synergySpeed(key, relatedCard, detail),
                value: synergyValueText(key),
            };

            const kind = synergyKind(key);
            if (kind === 'zone') {
                const zoneKey = `${entry.source}:${key}:${entry.detail}`;
                if (!seenZoneOptions.has(zoneKey)) {
                    seenZoneOptions.add(zoneKey);
                    zoneOptions.push(entry);
                }
            } else {
                for (const option of castOptions) {
                    if (isThresholdTokenCopyDetail(detail) && option.costValue < (synergyActionCost(card, relatedCard, key) ?? 0)) {
                        continue;
                    }

                    if (kind === 'permanent') {
                        option.permanentOptions.push(entry);
                    } else {
                        option.bonuses.push(entry);
                    }
                }
            }
        }
    }

    return {
        castOptions,
        zoneOptions,
    };
}
