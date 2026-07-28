const defaultFeedbackStore = {
    comments: {},
};

function cloneFeedbackStore(store = defaultFeedbackStore) {
    return {
        comments: { ...(store.comments ?? {}) },
    };
}

class BrowserParserFeedbackStorage {
    constructor() {
        this.storageKey = 'mtg-proxy-parser-feedback';
    }

    async isEnabled() {
        return true;
    }

    async loadFeedback() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            return raw ? cloneFeedbackStore(JSON.parse(raw)) : cloneFeedbackStore();
        } catch {
            return cloneFeedbackStore();
        }
    }

    async saveFeedback(feedback) {
        const store = cloneFeedbackStore(feedback);
        localStorage.setItem(this.storageKey, JSON.stringify(store));
        return store;
    }
}

class FileParserFeedbackStorage {
    async isEnabled() {
        return true;
    }

    async request(options = {}) {
        const response = await fetch('/api/parser-feedback', {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        });

        if (!response.ok) {
            throw new Error(`Parser feedback storage request failed: ${response.status}`);
        }

        return response.json();
    }

    async loadFeedback() {
        return cloneFeedbackStore(await this.request());
    }

    async saveFeedback(feedback) {
        return cloneFeedbackStore(await this.request({
            method: 'PUT',
            body: JSON.stringify(cloneFeedbackStore(feedback)),
        }));
    }
}

export function createParserFeedbackStorage() {
    if (import.meta.env.VITE_LOCAL_APP === 'true') {
        return new FileParserFeedbackStorage();
    }

    return new BrowserParserFeedbackStorage();
}
