import { analyzeCardValue } from './CardValueAnalyzer.mjs';
import {
    damageAmount,
    isCreatureCard,
    spellSpeed,
    summarizeCreatureInteractions,
    synergyActionCost,
    synergyInteractionDetail
} from './DeckInteractionAnalyzer.mjs';

export function countCards(cards) {
    return cards.reduce((total, card) => total + (card.quantity ?? 1), 0);
}

export function cardsForAnalysisCategory(summary, categoryKey) {
    return categoryKey.split('.').reduce((value, part) => {
        return value?.[part];
    }, summary) ?? [];
}

export function isSynergyCategory(category) {
    return category.key.startsWith('synergy.');
}

function selected(card) {
    return card.selectedOption ?? card;
}

function manaCostOf(card) {
    return selected(card).manaCost ?? '';
}

function manaValueOf(card) {
    const manaValue = Number(selected(card).manaValue);
    if (Number.isFinite(manaValue)) {
        return manaValue;
    }

    return [...manaCostOf(card).matchAll(/\{([^}]+)\}/g)].reduce((total, match) => {
        const symbol = match[1];
        if (/^\d+$/.test(symbol)) {
            return total + parseInt(symbol, 10);
        }

        return /^X$/i.test(symbol) ? total : total + 1;
    }, 0);
}

function sourceColorNames(card) {
    const selectedCard = selected(card);
    if (Array.isArray(selectedCard.colors) && selectedCard.colors.length > 0) {
        return selectedCard.colors.map(color => String(color).toLowerCase());
    }

    const colorMap = {
        W: 'white',
        U: 'blue',
        B: 'black',
        R: 'red',
        G: 'green',
    };

    const colors = [...manaCostOf(card).matchAll(/\{([WUBRG])\}/gi)]
        .map(match => colorMap[match[1].toUpperCase()])
        .filter(Boolean);

    return colors.length > 0 ? colors : ['colorless'];
}

function removalCategoryOutcome(categoryKey) {
    if (categoryKey === 'instantRemoval' || categoryKey === 'sorceryRemoval') {
        return 'kill';
    }

    const match = /^removalActions\.(?:instant|sorcery)\.(kill|damage|targetable|blockedTarget)$/.exec(categoryKey);
    return match?.[1] ?? '';
}

function isRemovalCategory(categoryKey) {
    return categoryKey === 'instantRemoval' ||
        categoryKey === 'sorceryRemoval' ||
        categoryKey.startsWith('removalActions.');
}

function manaTradeText(sourceCard, targetCard) {
    const delta = manaValueOf(targetCard) - manaValueOf(sourceCard);
    if (delta === 0) {
        return 'mana even';
    }

    return `mana ${delta > 0 ? '+' : ''}${delta}`;
}

function cardTradeText(sourceCard, targetCard, outcome) {
    if (outcome === 'damage') {
        return 'cards -1';
    }

    if (selected(targetCard).isToken) {
        return 'cards +1';
    }

    if (selected(sourceCard).isToken) {
        return 'cards -1';
    }

    return 'cards even';
}

function statValue(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function instantSorceryToughnessPump(card) {
    const oracleText = selected(card).oracleText ?? '';
    const pump = /whenever you cast an instant or sorcery spell, this creature gets \+\d+\/\+?(\d+) until end of turn/i.exec(oracleText);
    return pump ? parseInt(pump[1], 10) : 0;
}

function isInstantOrSorcery(card) {
    return /\b(?:Instant|Sorcery)\b/i.test(selected(card).typeLine ?? '');
}

function toughnessTriggerResponses(sourceCard, targetCard, deckCards) {
    const damage = damageAmount(sourceCard);
    const toughness = statValue(selected(targetCard).toughness);
    const toughnessPump = instantSorceryToughnessPump(targetCard);
    if (damage <= 0 || toughness === null || toughnessPump <= 0 || damage < toughness || damage >= toughness + toughnessPump) {
        return [];
    }

    return deckCards
        .filter(card => card !== sourceCard && card !== targetCard && isInstantOrSorcery(card))
        .map(card => {
            return {
                name: `${card.name} -> ${targetCard.name} +0/+${toughnessPump}`,
                quantity: card.quantity ?? 1,
            };
        });
}

function possibleResponses(sourceCard, targetCard, deckCards) {
    const directResponses = deckCards.filter(card => {
        if (card === sourceCard || card === targetCard || spellSpeed(card) !== 'instant') {
            return false;
        }

        const oracleText = selected(card).oracleText ?? '';
        return /\bcounter target (?:spell|instant|instant or sorcery|noncreature)/i.test(oracleText) ||
            /\btarget creature\b[^.]*\bgains? hexproof\b/i.test(oracleText) ||
            /\btarget creature\b[^.]*\bgains? protection\b/i.test(oracleText) ||
            /\bprevent\b[^.]*\bdamage\b/i.test(oracleText);
    });

    return [...directResponses, ...toughnessTriggerResponses(sourceCard, targetCard, deckCards)];
}

function removalInteractionDetail(sourceCard, targetCard, categoryKey, deckCards) {
    const outcome = removalCategoryOutcome(categoryKey);
    const colors = sourceColorNames(sourceCard).join('/');
    const damage = damageAmount(sourceCard);
    const actionText = outcome === 'damage'
        ? `damage ${colors}${damage > 0 ? ` ${damage}` : ''}`
        : outcome === 'targetable'
            ? `target ${colors}`
            : outcome === 'blockedTarget'
                ? `blocked ${colors}`
                : `kill ${colors}`;
    const responses = possibleResponses(sourceCard, targetCard, deckCards);
    const responseText = responses.length > 0
        ? `; responses: ${responses.map(card => `${card.quantity ?? 1}x ${card.name}`).join(', ')}`
        : '';

    return `${actionText}; ${manaTradeText(sourceCard, targetCard)}; ${cardTradeText(sourceCard, targetCard, outcome)}${responseText}`;
}

export function formatAnalysisValue(card, quantity, total, metric) {
    const prefix = card.isSideboard ? '+' : '';

    if (metric === 'percent') {
        const percent = total > 0
            ? quantity / total * 100
            : 0;
        return `${prefix}${percent.toFixed(1)}%`;
    }

    return `${prefix}${quantity}`;
}

export function buildAnalysisCell(card, category, column, metric) {
    const targets = category.targetGroup === 'cards' ? column.cards ?? [] : column.creatures ?? [];
    const sourceTargets = isSynergyCategory(category) && column.allCards
        ? column.allCards
        : targets;
    const matchedCards = [];
    let matchedQuantity = 0;
    const denominator = column.totalCards ?? countCards(column.creatures ?? []);

    for (const targetCard of sourceTargets) {
        const summary = summarizeCreatureInteractions([card], targetCard);
        if (cardsForAnalysisCategory(summary, category.key).length > 0) {
            const actionCost = synergyActionCost(card, targetCard, category.key);
            if (
                isSynergyCategory(category) &&
                column.actionCost !== undefined &&
                (actionCost === null || Math.min(Math.floor(actionCost), 9) !== column.actionCost)
            ) {
                continue;
            }

            const detail = isRemovalCategory(category.key)
                ? removalInteractionDetail(card, targetCard, category.key, column.cards ?? [])
                : synergyInteractionDetail(card, targetCard, category.key);
            const detailText = detail ? ` - ${detail}` : '';
            matchedQuantity += targetCard.quantity ?? 1;
            matchedCards.push(`${targetCard.quantity ?? 1}x ${targetCard.name}${detailText}`);
        }
    }

    if (matchedQuantity === 0) {
        return {
            active: false,
            display: '-',
            title: '',
        };
    }

    return {
        active: true,
        display: formatAnalysisValue(card, matchedQuantity, denominator, metric),
        title: matchedCards.join(', '),
    };
}

export function buildMetaDeckRemovalSummary(card, column) {
    const creatures = column.creatures ?? [];
    const totalQuantity = column.totalCards ?? countCards(column.cards ?? creatures);
    let killedQuantity = 0;
    let interactedQuantity = 0;

    for (const creature of creatures) {
        const summary = summarizeCreatureInteractions([card], creature);
        const isKilled = summary.instantRemoval.length > 0 || summary.sorceryRemoval.length > 0;
        const hasInteraction = isKilled ||
            summary.removalActions.instant.damage.length > 0 ||
            summary.removalActions.sorcery.damage.length > 0 ||
            summary.removalActions.instant.targetable.length > 0 ||
            summary.removalActions.sorcery.targetable.length > 0;

        if (isKilled) {
            killedQuantity += creature.quantity ?? 1;
        }

        if (hasInteraction) {
            interactedQuantity += creature.quantity ?? 1;
        }
    }

    const percent = quantity => {
        return totalQuantity > 0
            ? `${(quantity / totalQuantity * 100).toFixed(1)}%`
            : '0.0%';
    };

    return {
        killedQuantity,
        interactedQuantity,
        totalQuantity,
        killPercent: percent(killedQuantity),
        interactionPercent: percent(interactedQuantity),
    };
}

function removalOutcomeForTarget(card, targetCard) {
    const summary = summarizeCreatureInteractions([card], targetCard);
    if (summary.instantRemoval.length > 0 || summary.sorceryRemoval.length > 0) {
        return 'kill';
    }

    if (summary.removalActions.instant.damage.length > 0 || summary.removalActions.sorcery.damage.length > 0) {
        return 'damage';
    }

    if (summary.removalActions.instant.targetable.length > 0 || summary.removalActions.sorcery.targetable.length > 0) {
        return 'target';
    }

    return '';
}

function removalCategoryForOutcome(card, outcome) {
    const speed = spellSpeed(card) ?? 'sorcery';
    if (outcome === 'kill') {
        return speed === 'instant' ? 'instantRemoval' : 'sorceryRemoval';
    }

    return `removalActions.${speed}.${outcome === 'target' ? 'targetable' : outcome}`;
}

function buildMetaRemovalTargets(card, column) {
    return (column.creatures ?? [])
        .map(targetCard => {
            const outcome = removalOutcomeForTarget(card, targetCard);
            if (!outcome) {
                return null;
            }

            const responses = possibleResponses(card, targetCard, column.cards ?? []);
            return {
                name: targetCard.name,
                quantity: targetCard.quantity ?? 1,
                outcome,
                detail: removalInteractionDetail(card, targetCard, removalCategoryForOutcome(card, outcome), column.cards ?? []),
                protection: responses.map(response => `${response.quantity ?? 1}x ${response.name}`).join(', '),
            };
        })
        .filter(Boolean);
}

function buildMetaRemovalOptions(card, columns = []) {
    if (damageAmount(card) <= 0) {
        return [];
    }

    return columns
        .filter(column => column.type === 'metaDeck')
        .map(column => {
            const summary = buildMetaDeckRemovalSummary(card, column);
            const targets = buildMetaRemovalTargets(card, column);
            if (targets.length === 0) {
                return null;
            }

            return {
                deckId: column.key,
                deckName: column.label,
                removedPercent: summary.killPercent,
                affectedPercent: summary.interactionPercent,
                removedQuantity: summary.killedQuantity,
                affectedQuantity: summary.interactedQuantity,
                totalQuantity: summary.totalQuantity,
                effect: 'Battlefield removal',
                value: 'Removal coverage',
                targets,
            };
        })
        .filter(Boolean);
}

export function buildAnalysisRowsForCard(card, categories, columns, metric) {
    return categories
        .map(category => {
            const cells = columns.map(column => {
                return {
                    column,
                    cell: buildAnalysisCell(card, category, column, metric),
                };
            });

            return {
                category,
                cells,
            };
        })
        .filter(row => row.cells.some(({ cell }) => cell.active));
}

export function buildValueAnalysisForCard(card, relatedCards, columns = []) {
    const value = analyzeCardValue(card, relatedCards);
    const metaRemovalOptions = buildMetaRemovalOptions(card, columns);

    return {
        ...value,
        castOptions: value.castOptions.map(option => {
            return {
                ...option,
                metaRemovalOptions,
            };
        }),
    };
}

export function buildCreatureColumns(sessions) {
    return sessions.map(session => {
        return {
            key: session.id,
            label: session.name,
            cards: session.state?.cards ?? [],
            creatures: (session.state?.cards ?? []).filter(card => isCreatureCard(card)),
            totalCards: countCards(session.state?.cards ?? []),
        };
    });
}
