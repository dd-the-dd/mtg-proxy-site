import { analyzeCardValue } from './CardValueAnalyzer.mjs';
import {
    isCreatureCard,
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

            const detail = synergyInteractionDetail(card, targetCard, category.key);
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

export function buildValueAnalysisForCard(card, relatedCards) {
    return analyzeCardValue(card, relatedCards);
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
