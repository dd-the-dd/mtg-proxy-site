import { vi } from "vitest";
import { config } from "@vue/test-utils";

// Node 25+ has a built-in localStorage stub that lacks getItem/setItem.
// Vitest's happy-dom environment doesn't override it because it's already on globalThis.
// Provide a minimal Storage implementation so tests can run on Node 25+.
if (typeof localStorage !== 'undefined' && typeof localStorage.getItem !== 'function') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (index) => [...store.keys()][index] ?? null,
    };
}

config.global.mocks = {
    // Mock vue-i18n's primary method globally.
    $t: vi.fn((key) => key),
};

const localSessionStore = {
    sessions: [],
};

globalThis.__localSessionStore = localSessionStore;
globalThis.__resetLocalSessions = () => {
    localSessionStore.sessions = [];
};

globalThis.fetch = vi.fn(async (url, options = {}) => {
    const parsedUrl = new URL(url, 'http://localhost');
    if (!parsedUrl.pathname.startsWith('/api/local-sessions')) {
        return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
        };
    }

    const id = decodeURIComponent(parsedUrl.pathname.replace('/api/local-sessions', '').replace(/^\//, ''));
    const method = options.method ?? 'GET';

    if (method === 'GET' && !id) {
        return {
            ok: true,
            status: 200,
            json: async () => ({
                sessions: localSessionStore.sessions.map(session => {
                    return {
                        id: session.id,
                        name: session.name,
                        isMetaDeck: Boolean(session.isMetaDeck),
                        updatedAt: session.updatedAt,
                    };
                }),
            }),
        };
    }

    if (method === 'POST' && !id) {
        const body = JSON.parse(options.body ?? '{}');
        const session = {
            id: `session-${localSessionStore.sessions.length + 1}`,
            name: body.name,
            isMetaDeck: Boolean(body.isMetaDeck),
            state: body.state,
            updatedAt: new Date().toISOString(),
        };
        localSessionStore.sessions.unshift(session);
        return {
            ok: true,
            status: 200,
            json: async () => session,
        };
    }

    const sessionIndex = localSessionStore.sessions.findIndex(session => session.id === id);
    if (sessionIndex === -1) {
        return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Session not found' }),
        };
    }

    if (method === 'GET') {
        return {
            ok: true,
            status: 200,
            json: async () => localSessionStore.sessions[sessionIndex],
        };
    }

    if (method === 'PUT') {
        const body = JSON.parse(options.body ?? '{}');
        localSessionStore.sessions[sessionIndex] = {
            ...localSessionStore.sessions[sessionIndex],
            name: body.name,
            isMetaDeck: Boolean(body.isMetaDeck),
            state: body.state,
            updatedAt: new Date().toISOString(),
        };
        return {
            ok: true,
            status: 200,
            json: async () => localSessionStore.sessions[sessionIndex],
        };
    }

    return {
        ok: false,
        status: 405,
        json: async () => ({ error: 'Method not allowed' }),
    };
});
