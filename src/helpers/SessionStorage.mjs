class DisabledSessionStorage {
    async isEnabled() {
        return false;
    }

    async listSessions() {
        return [];
    }

    async createSession() {
        return null;
    }

    async loadSession() {
        return null;
    }

    async saveSession() {
        return null;
    }
}

class FileSessionStorage {
    async isEnabled() {
        return true;
    }

    async request(path, options = {}) {
        const response = await fetch(`/api/local-sessions${path}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options,
        });

        if (!response.ok) {
            throw new Error(`Local session storage request failed: ${response.status}`);
        }

        return response.json();
    }

    async listSessions() {
        const data = await this.request('');
        return data.sessions;
    }

    async createSession(name = 'Untitled Session', state = null) {
        return this.request('', {
            method: 'POST',
            body: JSON.stringify({ name, state }),
        });
    }

    async loadSession(id) {
        return this.request(`/${encodeURIComponent(id)}`);
    }

    async saveSession(session) {
        return this.request(`/${encodeURIComponent(session.id)}`, {
            method: 'PUT',
            body: JSON.stringify(session),
        });
    }
}

export function createSessionStorage() {
    if (import.meta.env.VITE_LOCAL_APP === 'true') {
        return new FileSessionStorage();
    }

    return new DisabledSessionStorage();
}
