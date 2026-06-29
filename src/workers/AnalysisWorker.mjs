import {
    buildAnalysisRowsForCard,
    buildValueAnalysisForCard
} from '../helpers/AnalysisModel.mjs';

self.onmessage = event => {
    const {
        id,
        card,
        categories,
        columns,
        metric,
        relatedCards,
    } = event.data;

    self.postMessage({
        id,
        rows: buildAnalysisRowsForCard(card, categories, columns, metric),
        value: buildValueAnalysisForCard(card, relatedCards, columns),
    });
};
