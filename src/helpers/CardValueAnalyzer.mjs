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

function manaCostValue(cost) {
    return manaSymbols(cost).reduce((total, symbol) => {
        if (/^\d+$/.test(symbol)) {
            return total + parseInt(symbol, 10);
        }

        return /^X$/i.test(symbol) ? total : total + 1;
    }, 0);
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

    const look = /\blook at the top (\d+) cards?/i.exec(text);
    if (look) {
        values.push(`Look ${look[1]}`);
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
    if (/\.feeders$/.test(key)) {
        return 'permanent';
    }

    if (/graveyardPlay|battlefieldToHand|entersBattlefield/.test(key)) {
        return 'zone';
    }

    return 'bonus';
}

function synergyCondition(key, card, relatedCard) {
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

function castEffectText(card, drawn) {
    const effects = [...qualityValues(card)];
    if (drawn > 0) {
        effects.push(`Draw ${drawn}`);
    }

    return effects.join(', ');
}

function castValueText(card, handValue) {
    if (qualityValues(card).length > 0) {
        return 'Card quality improvement';
    }

    return handValue;
}

function detailSpeed(detail) {
    return /^I:/.test(detail) ? 'Instant' : 'Sorcery';
}

function detailEffect(detail) {
    return detail.replace(/^[IS]:/, '').replace(/\scost \d+$/, '');
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

    const bonuses = [];
    const permanentOptions = [];
    const zoneChanges = [];

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
                speed: detailSpeed(detail),
                value: synergyValueText(key),
            };

            const kind = synergyKind(key);
            if (kind === 'permanent') {
                permanentOptions.push(entry);
            } else if (kind === 'zone') {
                zoneChanges.push(entry);
            } else {
                bonuses.push(entry);
            }
        }
    }

    return {
        castOptions: [
            {
                label: 'Cast',
                cost: manaCostOf(card),
                costValue: manaCostValue(manaCostOf(card)),
                speed: castSpeed(card),
                symbols: manaSymbols(manaCostOf(card)),
                baseRows: [
                    {
                        condition: 'Cast',
                        cost: manaCostOf(card),
                        costSymbols: manaSymbols(manaCostOf(card)),
                        effect: castEffectText(card, drawn),
                        speed: castSpeed(card),
                        value: castValueText(card, handValue),
                    },
                ],
                values,
                bonuses,
                permanentOptions,
                zoneChanges,
            },
        ],
    };
}
