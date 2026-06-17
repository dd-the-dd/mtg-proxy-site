import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { defineConfig, loadEnv } from "vite";
import vue from '@vitejs/plugin-vue';

function localSessionsPlugin(env) {
    const enabled = env.VITE_LOCAL_APP === 'true';
    const storageDir = path.resolve(process.cwd(), '.local-app');
    const storageFile = path.join(storageDir, 'sessions.json');

    const readJsonBody = async (req) => {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }

        const body = Buffer.concat(chunks).toString('utf8');
        return body ? JSON.parse(body) : {};
    };

    const loadStore = async () => {
        try {
            const raw = await fs.readFile(storageFile, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }

            return { sessions: [] };
        }
    };

    const saveStore = async (store) => {
        await fs.mkdir(storageDir, { recursive: true });
        await fs.writeFile(storageFile, JSON.stringify(store, null, 2));
    };

    const sendJson = (res, status, data) => {
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    };

    return {
        name: 'local-sessions',
        configureServer(server) {
            if (!enabled) {
                return;
            }

            server.middlewares.use('/api/local-sessions', async (req, res) => {
                try {
                    const url = new URL(req.url, 'http://local-app');
                    const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
                    const store = await loadStore();

                    if (req.method === 'GET' && !id) {
                        sendJson(res, 200, {
                            sessions: store.sessions.map(session => {
                                return {
                                    id: session.id,
                                    name: session.name,
                                    updatedAt: session.updatedAt,
                                };
                            }),
                        });
                        return;
                    }

                    if (req.method === 'POST' && !id) {
                        const body = await readJsonBody(req);
                        const now = new Date().toISOString();
                        const session = {
                            id: randomUUID(),
                            name: body.name || 'Untitled Session',
                            state: body.state ?? null,
                            updatedAt: now,
                        };
                        store.sessions.unshift(session);
                        await saveStore(store);
                        sendJson(res, 200, session);
                        return;
                    }

                    const sessionIndex = store.sessions.findIndex(session => session.id === id);
                    if (sessionIndex === -1) {
                        sendJson(res, 404, { error: 'Session not found' });
                        return;
                    }

                    if (req.method === 'GET') {
                        sendJson(res, 200, store.sessions[sessionIndex]);
                        return;
                    }

                    if (req.method === 'PUT') {
                        const body = await readJsonBody(req);
                        const now = new Date().toISOString();
                        const session = {
                            ...store.sessions[sessionIndex],
                            name: body.name || store.sessions[sessionIndex].name,
                            state: body.state ?? store.sessions[sessionIndex].state,
                            updatedAt: now,
                        };
                        store.sessions[sessionIndex] = session;
                        await saveStore(store);
                        sendJson(res, 200, session);
                        return;
                    }

                    sendJson(res, 405, { error: 'Method not allowed' });
                } catch (error) {
                    sendJson(res, 500, { error: error.message });
                }
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [vue(), localSessionsPlugin(env)],
        build: {
            sourcemap: true,
        },
        test: {
            environment: 'happy-dom',
            setupFiles: [
                './vitest.setup.mjs',
            ],
        },
        // Replacement values. These are set at build time.
        define: {
            'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString()),
            'import.meta.env.VITE_BUILD_SHA': JSON.stringify(process.env.VITE_BUILD_SHA ?? 'local'),
            'import.meta.env.VITE_LOCAL_APP': JSON.stringify(env.VITE_LOCAL_APP ?? 'false'),
        },
    };
});
