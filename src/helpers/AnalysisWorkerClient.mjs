import {
    buildAnalysisRowsForCard,
    buildValueAnalysisForCard
} from './AnalysisModel.mjs';

function createDirectAnalysisClient() {
    return {
        async analyze(payload) {
            return {
                rows: buildAnalysisRowsForCard(
                    payload.card,
                    payload.categories,
                    payload.columns,
                    payload.metric,
                ),
                value: buildValueAnalysisForCard(payload.card, payload.relatedCards, payload.columns),
            };
        },
        terminate() {},
    };
}

export function createAnalysisWorkerClient() {
    if (typeof Worker === 'undefined') {
        return createDirectAnalysisClient();
    }

    let worker;
    try {
        worker = new Worker(new URL('../workers/AnalysisWorker.mjs', import.meta.url), {
            type: 'module',
        });
    } catch {
        return createDirectAnalysisClient();
    }
    let nextId = 0;
    const pending = new Map();

    worker.onmessage = event => {
        const { id, rows, value } = event.data;
        const request = pending.get(id);
        if (!request) {
            return;
        }

        pending.delete(id);
        request.resolve({ rows, value });
    };
    worker.onerror = error => {
        for (const request of pending.values()) {
            request.reject(error);
        }
        pending.clear();
    };

    return {
        analyze(payload) {
            const id = ++nextId;
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                try {
                    worker.postMessage({ id, ...payload });
                } catch (error) {
                    pending.delete(id);
                    reject(error);
                }
            });
        },
        terminate() {
            worker.terminate();
            pending.clear();
        },
    };
}
