import { mount } from '@vue/test-utils';
import ProxyPage from './ProxyPage.vue';
import { describe, expect, test, beforeAll, vi } from 'vitest';

const wrapper = mount(ProxyPage, {
    mocks: {
        $t: () => {},
    },
});

beforeAll(async () => {
    // Wait for the Async mounted functions to run and initialize the card dataset.
    while(Object.keys(wrapper.getCurrentComponent().data.sets).length === 0) {
        await new Promise(r => setTimeout(r, 50));
    }
}, 90000);

describe('Core Rendering', async () => {
    test('Renders', () => {
        expect(wrapper.find('#deck-input').exists()).toBe(true);
    });

    test('Feature: Game piece opposite-side pairing is the default token back mode.', () => {
        expect(wrapper.getCurrentComponent().data.config.tokenBackMode).toBe('opposite');
    });

    test('Feature: Local app mode exposes named file-backed sessions.', async () => {
        const component = wrapper.getCurrentComponent();

        while(!component.data.activeSessionId) {
            await new Promise(r => setTimeout(r, 50));
        }

        expect(wrapper.find('#local-session-menu').exists()).toBe(true);
        expect(wrapper.find('#new-local-session').exists()).toBe(true);
        expect(component.data.localSessions.length).toBeGreaterThan(0);
    });

    test('Feature: Left analysis rail collapses toward the page edge.', async () => {
        expect(wrapper.find('.app-layout-sidebar-collapsed').exists()).toBe(false);

        await wrapper.find('#toggle-left-menu').trigger('click');
        expect(wrapper.find('.app-layout-sidebar-collapsed').exists()).toBe(true);

        await wrapper.find('#toggle-left-menu').trigger('click');
        expect(wrapper.find('.app-layout-sidebar-collapsed').exists()).toBe(false);
    });

    test('Feature: Resource navigation exposes contextual deck, print, analysis, play, card analysis, compare, and meta workspaces.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'deck';
        component.data.config.analysisMode = false;
        component.data.config.simulationGameStarted = false;
        component.data.config.simulationPlayerDeckIds = ['meta-one', 'meta-one'];
        component.data.cards = [
            {
                quantity: 1,
                name: 'opt',
                selectedOption: {
                    manaCost: '{U}',
                    typeLine: 'Instant',
                    urlFront: 'opt-front',
                },
                setOptions: [],
            },
        ];
        component.data.localSessions = [
            {
                id: 'meta-one',
                name: 'Izzet Prowess',
                isMetaDeck: true,
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'meta-one',
                name: 'Izzet Prowess',
                state: {
                    cards: [
                        {
                            quantity: 1,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.find('#resource-nav').exists()).toBe(true);
        expect(wrapper.find('#resource-tab-deck').classes()).toContain('active');
        expect(wrapper.find('#deck-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#print-resource-panel').exists()).toBe(false);

        await wrapper.find('#resource-tab-print').trigger('click');
        expect(component.data.config.activeWorkspaceTab).toBe('print');
        expect(wrapper.find('#print-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#deck-input').exists()).toBe(false);

        await wrapper.find('#resource-tab-analysis').trigger('click');
        expect(component.data.config.activeWorkspaceTab).toBe('analysis');
        expect(wrapper.find('#analysis-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#analysis-card-list').exists()).toBe(true);

        await wrapper.find('#resource-tab-card-analysis').trigger('click');
        expect(wrapper.find('#card-analysis-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#card-analysis-effect-registry').exists()).toBe(true);
        expect(wrapper.find('#card-analysis-effect-registry').text()).toContain('Whenever enters the battlefield');
        expect(wrapper.find('#card-analysis-effect-registry').text()).toContain('Permanent modifiers');
        expect(wrapper.find('#card-analysis-effect-registry').text()).toContain('Rule parameters');

        await wrapper.find('#resource-tab-compare').trigger('click');
        expect(wrapper.find('#compare-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#compare-main').exists()).toBe(true);

        await wrapper.find('#resource-tab-meta').trigger('click');
        expect(wrapper.find('#meta-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#meta-resource-panel').text()).toContain('Izzet Prowess');

        await wrapper.find('#resource-tab-deck').trigger('click');
        expect(wrapper.find('#deck-resource-panel').exists()).toBe(true);

        await wrapper.find('#resource-tab-play').trigger('click');
        expect(wrapper.find('#play-resource-panel').exists()).toBe(true);
        expect(wrapper.find('#app-sidebar').exists()).toBe(false);
        expect(wrapper.find('#play-setup-panel').exists()).toBe(true);
        expect(wrapper.find('#simulation-matchup').exists()).toBe(false);
        expect(wrapper.find('#simulation-turn-count').exists()).toBe(false);
        expect(wrapper.text()).not.toContain('Matchup');
        expect(wrapper.findAll('.simulation-player-deck')).toHaveLength(2);
        expect(wrapper.findAll('.simulation-player-deck')[0].element.value).toBe('current');
        expect(component.data.config.simulationPlayerDeckIds[0]).toBe('current');
        expect(wrapper.findAll('.simulation-player-deck')[0].text()).toContain('Loaded deck');
        expect(wrapper.findAll('.simulation-player-deck')[0].text()).toContain('Izzet Prowess');
        expect(wrapper.findAll('.simulation-player-deck')[1].text()).toContain('Izzet Prowess');
        await wrapper.findAll('.simulation-player-deck')[0].setValue('meta-one');
        expect(component.data.config.simulationPlayerDeckIds[0]).toBe('meta-one');
        expect(component.proxy.gameSimulation.playerList[0].zones.hand).toContainEqual(expect.objectContaining({
            name: 'island',
        }));
        expect(wrapper.find('.simulation-board').exists()).toBe(false);
        expect(wrapper.find('#resource-nav').exists()).toBe(true);

        await wrapper.find('#start-simulation-game').trigger('click');
        expect(wrapper.find('#play-setup-panel').exists()).toBe(false);
        expect(wrapper.find('.simulation-board').exists()).toBe(true);
        expect(wrapper.find('#resource-nav').exists()).toBe(false);
        expect(wrapper.find('#play-board-options').exists()).toBe(true);

        component.data.config.activeWorkspaceTab = 'deck';
        component.data.config.analysisMode = false;
        component.data.config.simulationGameStarted = false;
        component.data.cards = [];
        component.data.localSessions = [];
        component.data.metaDeckStates = [];
        await wrapper.vm.$nextTick();
    });

    test('Feature: Play resource opens persisted simulation sessions on setup before showing the board.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = false;
        component.data.config.simulationPlayerDeckIds = ['current', 'meta-one'];
        component.data.cards = [
            {
                quantity: 8,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'meta-one',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.find('#play-setup-panel').exists()).toBe(true);
        expect(wrapper.find('#simulation-matchup').exists()).toBe(false);
        expect(wrapper.find('#simulation-turn-count').exists()).toBe(false);
        expect(wrapper.findAll('.simulation-player-deck')).toHaveLength(2);
        expect(wrapper.findAll('.simulation-player-deck')[0].element.value).toBe('current');
        expect(wrapper.findAll('.simulation-player-deck')[0].text()).toContain('Loaded deck');
        expect(wrapper.findAll('.simulation-player-deck')[1].text()).toContain('Izzet Mirror');
        expect(wrapper.findAll('.simulation-player-deck')[1].text()).not.toContain('Matchup');
        expect(wrapper.find('.simulation-board').exists()).toBe(false);
        expect(wrapper.find('.simulation-log-panel').exists()).toBe(false);
        expect(document.body.classList.contains('play-board-active')).toBe(false);

        await wrapper.find('#start-simulation-game').trigger('click');

        expect(wrapper.find('#play-setup-panel').exists()).toBe(false);
        expect(wrapper.find('.simulation-board').exists()).toBe(true);
        expect(wrapper.find('#play-board-options').exists()).toBe(true);
        expect(wrapper.find('.simulation-log-panel').exists()).toBe(false);
        expect(document.body.classList.contains('play-board-active')).toBe(true);
        expect(component.ctx.captureSessionState().config.simulationGameStarted).toBe(false);

        component.data.config.activeWorkspaceTab = 'deck';
        component.data.config.simulationGameStarted = false;
        component.data.cards = [];
        component.data.metaDeckStates = [];
        await wrapper.vm.$nextTick();
        expect(document.body.classList.contains('play-board-active')).toBe(false);
    });

    test('Feature: Simulation start asks for mulligan decisions before the first interactive step.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = false;
        component.data.config.simulationMulliganEnabled = true;
        component.data.config.simulationFreeMulligans = 0;
        component.data.config.simulationPlayerCount = 2;
        component.data.config.simulationPlayerRoles = ['human', 'ai'];
        component.data.config.simulationSeed = 1;
        component.data.config.simulationTurnCount = 1;
        component.data.cards = [
            {
                quantity: 8,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'mulligan-meta',
                name: 'Mulligan Meta',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                    ],
                },
            },
        ];
        component.data.config.simulationPlayerDeckIds = ['current', 'mulligan-meta'];
        await wrapper.vm.$nextTick();

        await wrapper.find('#start-simulation-game').trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('#simulation-mulligan-panel').exists()).toBe(true);
        expect(component.data.config.simulationGameStarted).toBe(true);
        expect(component.data.config.simulationStepIndex).toBe(0);

        await wrapper.find('#simulation-mulligan-take').trigger('click');
        await wrapper.vm.$nextTick();
        expect(component.data.simulationMulliganCounts.you).toBe(1);
        expect(component.proxy.gameSimulation.players.you.zones.handCount).toBe(6);

        await wrapper.find('#simulation-mulligan-keep').trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('#simulation-mulligan-panel').exists()).toBe(false);
        expect(component.data.simulationMulliganKept.you).toBe(true);
        expect(component.proxy.activeSimulationStep.phase).toBe('main');
        expect(component.proxy.activeSimulationStep.playerKey).toBe('you');

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.config.simulationGameStarted = false;
        component.data.config.simulationStepIndex = 0;
        component.data.config.simulationMulliganEnabled = true;
        component.data.config.simulationFreeMulligans = 0;
        component.data.simulationMulliganCounts = {};
        component.data.simulationMulliganFlowActive = false;
        component.data.simulationMulliganKept = {};
        component.data.cards = [];
        component.data.metaDeckStates = [];
    });

    test('Feature: Hovering a card image opens a fast center-left card preview.', async () => {
        const component = wrapper.getCurrentComponent();
        vi.useFakeTimers();

        try {
            component.data.config.activeWorkspaceTab = 'cards';
            component.data.config.analysisMode = false;
            component.data.cards = [
                {
                    quantity: 1,
                    name: 'opt',
                    selectedOption: {
                        urlFront: 'https://cards.scryfall.io/border_crop/front/a/b/opt.jpg',
                    },
                    setOptions: [],
                },
            ];

            await wrapper.vm.$nextTick();

            const cardImage = wrapper.find('.card-image');
            expect(wrapper.find('#card-hover-preview').exists()).toBe(false);

            await cardImage.trigger('mouseenter');
            await vi.advanceTimersByTimeAsync(699);
            await wrapper.vm.$nextTick();
            expect(wrapper.find('#card-hover-preview').exists()).toBe(false);

            await vi.advanceTimersByTimeAsync(1);
            await wrapper.vm.$nextTick();

            const preview = wrapper.find('#card-hover-preview');
            expect(preview.exists()).toBe(true);
            expect(preview.find('.card-hover-preview-image').attributes('src')).toContain('/large/');
            expect(preview.find('.card-hover-preview-image').attributes('alt')).toBe('opt');

            await cardImage.trigger('mouseleave');
            await wrapper.vm.$nextTick();
            expect(wrapper.find('#card-hover-preview').exists()).toBe(false);
        } finally {
            vi.useRealTimers();
            component.data.cards = [];
            component.data.config.decklist = '';
            await wrapper.vm.$nextTick();
        }
    });

    test('Feature: Local app sessions restore saved page state.', async () => {
        const component = wrapper.getCurrentComponent();

        while(!component.data.activeSessionId) {
            await new Promise(r => setTimeout(r, 50));
        }

        component.data.config.decklist = '4 Lightning Bolt';
        component.data.cards = [
            {
                quantity: 4,
                name: 'lightning bolt',
                isBasic: false,
                selectedOption: { urlFront: 'bolt-front' },
            },
        ];
        component.data.activeSessionName = 'Burn Tokens';
        await component.ctx.saveActiveSession();
        const savedSessionId = component.data.activeSessionId;

        await component.ctx.createLocalSession();
        expect(component.data.config.decklist).toBe('');
        expect(component.data.cards).toEqual([]);

        await component.ctx.loadLocalSession(savedSessionId);

        expect(component.data.activeSessionName).toBe('Burn Tokens');
        expect(component.data.config.decklist).toBe('4 Lightning Bolt');
        expect(component.data.cards[0].name).toBe('lightning bolt');

        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Local app sessions persist quantity edits from deck text into loaded cards.', async () => {
        const component = wrapper.getCurrentComponent();

        while(!component.data.activeSessionId) {
            await new Promise(r => setTimeout(r, 50));
        }

        component.data.config.decklist = '1 Pest [tsos] 9';
        component.data.cards = [
            {
                quantity: 1,
                name: 'pest',
                requestedSet: 'tsos',
                requestedCollectorNumber: '9',
                isBasic: false,
                selectedOption: {
                    urlFront: 'pest-front',
                    isGamePiece: true,
                    isToken: true,
                },
            },
        ];
        await component.ctx.saveActiveSession();
        const savedSessionId = component.data.activeSessionId;

        component.data.config.decklist = '4 Pest [tsos] 9';
        await component.ctx.saveActiveSession();
        await component.ctx.createLocalSession();
        await component.ctx.loadLocalSession(savedSessionId);

        expect(component.data.config.decklist).toBe('4 Pest [tsos] 9');
        expect(component.data.cards[0].quantity).toBe(4);

        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Local app sessions persist the meta deck tag.', async () => {
        const component = wrapper.getCurrentComponent();

        while(!component.data.activeSessionId) {
            await new Promise(r => setTimeout(r, 50));
        }

        component.data.activeSessionIsMetaDeck = true;
        await component.ctx.saveActiveSession();

        expect(component.data.localSessions.find(session => {
            return session.id === component.data.activeSessionId;
        }).isMetaDeck).toBe(true);
    });

    test('Feature: Meta deck creature analysis counts current deck interaction categories.', async () => {
        const component = wrapper.getCurrentComponent();
        const slickshot = {
            quantity: 4,
            name: 'slickshot show-off',
            selectedOption: {
                typeLine: 'Creature - Bird Wizard',
                oracleText: 'Flying, haste',
                power: '1',
                toughness: '2',
            },
        };

        component.data.cards = [
            {
                quantity: 4,
                name: 'burst lightning',
                selectedOption: {
                    typeLine: 'Instant',
                    oracleText: 'Burst Lightning deals 2 damage to any target.',
                },
            },
            slickshot,
        ];
        component.data.metaDeckStates = [
            {
                id: 'izzet-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [slickshot],
                },
            },
        ];

        const analysis = component.proxy.metaCreatureAnalyses[0];

        expect(analysis.counts.instantRemoval).toBe(4);
        expect(analysis.counts.combat.attacking.bothSurvive).toBe(4);
        expect(analysis.counts.combat.defending.bothSurvive).toBe(4);

        component.data.config.decklist = '4 Wild Nacatl';
        component.data.metaDeckStates = [];
        await component.ctx.loadCardList();
    });

    test('Feature: Analysis mode renders card rows with sideboard interaction indicators.', async () => {
        const component = wrapper.getCurrentComponent();
        const slickshot = {
            quantity: 4,
            name: 'slickshot show-off',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Creature - Bird Wizard',
                oracleText: 'Flying, haste',
                power: '1',
                toughness: '2',
            },
        };
        const sideboardBurst = {
            quantity: 2,
            name: 'burst lightning',
            isSideboard: true,
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            },
            setOptions: [
                {
                    name: 'Test (1)',
                    manaValue: 1,
                    typeLine: 'Instant',
                    oracleText: 'Burst Lightning deals 2 damage to any target.',
                    urlFront: 'burst-front',
                },
            ],
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [sideboardBurst];
        component.data.metaDeckStates = [
            {
                id: 'izzet-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [slickshot],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        const cell = component.ctx.cardAnalysisCell(
            sideboardBurst,
            component.proxy.analysisCategories[0],
            component.proxy.analysisColumns[0],
        );

        expect(wrapper.find('#analysis-card-list').exists()).toBe(true);
        expect(cell.display).toBe('+4');
        expect(cell.title).toContain('slickshot show-off');

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Simulation tab renders a deterministic matchup timeline against a meta deck.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = true;
        component.data.config.simulationSeed = 2;
        component.data.config.simulationTurnCount = 2;
        component.data.config.simulationPlayerCount = 4;
        component.data.config.simulationPlayerRoles = ['human', 'ai', 'human', 'ai'];
        component.data.config.simulationPlayerDeckIds = ['current', 'izzet-meta', 'aggro-meta', 'izzet-meta'];
        component.data.config.simulationShowOpponentHands = false;
        component.data.config.simulationSpeed = 'fast';
        component.data.config.simulationBoardZoom = 1.1;
        component.data.localSessions = [
            {
                id: 'izzet-meta',
                name: 'Izzet Mirror',
                isMetaDeck: true,
            },
            {
                id: 'aggro-meta',
                name: 'Aggro Meta',
                isMetaDeck: true,
            },
            {
                id: 'unloaded-meta',
                name: 'Unloaded Meta',
                isMetaDeck: true,
            },
            {
                id: 'non-meta',
                name: 'Kitchen Table',
                isMetaDeck: false,
            },
        ];
        component.data.cards = [
            {
                quantity: 8,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
            {
                quantity: 4,
                name: 'burst lightning',
                selectedOption: {
                    manaValue: 1,
                    manaCost: '{R}',
                    typeLine: 'Instant',
                    oracleText: 'Burst Lightning deals 2 damage to any target.',
                    urlFront: 'burst-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'izzet-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                        {
                            quantity: 4,
                            name: 'opt',
                            selectedOption: {
                                manaValue: 1,
                                manaCost: '{U}',
                                typeLine: 'Instant',
                            },
                        },
                        {
                            quantity: 4,
                            name: 'stormchaser talent',
                            selectedOption: {
                                manaValue: 1,
                                manaCost: '{U}',
                                typeLine: 'Enchantment - Class',
                            },
                        },
                    ],
                },
            },
            {
                id: 'aggro-meta',
                name: 'Aggro Meta',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'forest',
                            selectedOption: {
                                typeLine: 'Basic Land - Forest',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.find('#game-simulation-tab').exists()).toBe(true);
        expect(wrapper.find('#play-setup-panel').exists()).toBe(false);
        expect(wrapper.find('#simulation-matchup').exists()).toBe(false);
        expect(wrapper.findAll('.simulation-player-role')).toHaveLength(0);
        expect(wrapper.find('#play-board-options').exists()).toBe(true);
        expect(component.data.config.simulationPlayerCount).toBe(4);
        expect(component.data.config.simulationPlayerDeckIds).toEqual([
            'current',
            'izzet-meta',
            'aggro-meta',
            'izzet-meta',
        ]);
        expect(component.data.config.simulationShowOpponentHands).toBe(false);
        expect(component.data.config.simulationSpeed).toBe('fast');
        expect(component.data.config.simulationBoardZoom).toBe(1.1);
        expect(component.proxy.gameSimulation.playerList[1].zones.hand).toContainEqual(expect.objectContaining({
            name: 'island',
        }));
        expect(component.proxy.gameSimulation.playerList[2].zones.hand).toContainEqual(expect.objectContaining({
            name: 'forest',
        }));
        expect(component.proxy.gameSimulation.playerList[3].zones.hand).toContainEqual(expect.objectContaining({
            name: 'island',
        }));
        expect(wrapper.findAll('.simulation-player-board')).toHaveLength(4);
        expect(wrapper.findAll('.simulation-player-lane')).toHaveLength(2);
        expect(wrapper.findAll('.simulation-battlefield-lands').every(zone => {
            return zone.classes().includes('simulation-battlefield-column-left');
        })).toBe(true);
        expect(wrapper.findAll('.simulation-player-seat-top')[0].text()).toContain('Izzet Mirror');
        expect(wrapper.findAll('.simulation-player-seat-bottom')[0].text()).toContain('You');
        expect(wrapper.find('.simulation-hand-card-image').exists()).toBe(true);
        expect(wrapper.find('.simulation-board-area').attributes('style')).toContain('scale(1.1)');
        expect(wrapper.find('.simulation-battlefield-creatures').exists()).toBe(true);
        expect(wrapper.find('.simulation-battlefield-lands').exists()).toBe(true);
        expect(wrapper.find('.simulation-battlefield-noncreatures').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-graveyard').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-exile').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-empty').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-graveyard .simulation-zone-empty-card').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-exile .simulation-zone-empty-card').exists()).toBe(true);
        expect(wrapper.find('.simulation-zone-stack-graveyard .simulation-zone-image').exists()).toBe(false);
        expect(wrapper.find('.simulation-zone-stack-exile .simulation-zone-image').exists()).toBe(false);
        expect(wrapper.find('.simulation-zone-drawer').exists()).toBe(false);
        await wrapper.find('.simulation-zone-stack-graveyard').trigger('click');
        expect(wrapper.find('.simulation-zone-drawer').exists()).toBe(true);
        expect(wrapper.find('.simulation-log-panel').exists()).toBe(false);
        expect(wrapper.text()).toContain('Izzet Mirror');
        expect(wrapper.text()).toContain('T1 You');
        expect(component.proxy.gameSimulation.playerList[0].zones.hand).toContainEqual(expect.objectContaining({
            name: 'mountain',
        }));
        const firstMainStep = component.proxy.gameSimulation.timeline.find(step => {
            return step.playerName === 'You' && step.phase === 'main';
        });
        expect(firstMainStep.landPlaysAvailable).toBe(1);
        expect(firstMainStep.availableMana).toBe(0);
        expect(firstMainStep.manaAfterLandPlay).toBe(1);

        await wrapper.find('#simulation-reroll').trigger('click');
        expect(component.data.config.simulationSeed).toBe(3);
        expect(component.data.simulationHistory).toHaveLength(1);
        expect(wrapper.find('.simulation-history-entry').exists()).toBe(false);
        expect(component.data.simulationHistory[0].matchupName).toBe('Izzet Mirror');
        expect(component.ctx.captureSessionState().simulationHistory).toHaveLength(1);

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.metaDeckStates = [];
        component.data.config.simulationPlayerDeckIds = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Simulation board uses a compact two-player card-first layout.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = true;
        component.data.config.simulationPlayerDeckIds = ['current', 'two-player-meta'];
        component.data.config.simulationSeed = 1;
        component.data.config.simulationTurnCount = 1;
        component.data.config.simulationPlayerCount = 2;
        component.data.config.simulationPlayerRoles = ['human', 'ai'];
        component.data.cards = [
            {
                quantity: 8,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
            {
                quantity: 4,
                name: 'burst lightning',
                selectedOption: {
                    manaValue: 1,
                    typeLine: 'Instant',
                    urlFront: 'burst-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'two-player-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                        {
                            quantity: 4,
                            name: 'opt',
                            selectedOption: {
                                manaValue: 1,
                                typeLine: 'Instant',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('.simulation-player-lane')).toHaveLength(1);
        expect(wrapper.find('.simulation-board').classes()).toContain('simulation-board-compact');
        expect(wrapper.find('.simulation-board-area-two-player').exists()).toBe(true);
        expect(wrapper.find('.simulation-play-surface').exists()).toBe(true);
        expect(wrapper.find('.simulation-play-surface').classes()).toContain('simulation-play-surface-compact');
        expect(wrapper.find('.simulation-board-viewport').classes()).toContain('simulation-board-viewport-compact');
        expect(wrapper.find('.simulation-phase-bar').classes()).toContain('simulation-phase-bar-compact');
        expect(wrapper.find('.simulation-play-surface > .simulation-phase-bar').exists()).toBe(true);
        expect(Boolean(
            wrapper.find('.simulation-board-viewport').element.compareDocumentPosition(
                wrapper.find('.simulation-phase-bar').element,
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        )).toBe(true);
        expect(wrapper.findAll('.simulation-player-board')).toHaveLength(2);
        expect(wrapper.find('.simulation-hand-zone .simulation-section-title').exists()).toBe(false);
        expect(wrapper.find('.simulation-battlefield-zone').exists()).toBe(true);
        expect(wrapper.find('.simulation-battlefield-support').exists()).toBe(false);
        expect(wrapper.find('.simulation-battlefield-creatures .simulation-section-title').exists()).toBe(false);
        expect(wrapper.find('.simulation-battlefield-lands .simulation-section-title').exists()).toBe(false);
        expect(wrapper.find('.simulation-battlefield-noncreatures .simulation-section-title').exists()).toBe(false);
        expect(wrapper.find('.simulation-hand-zone').attributes('aria-label')).toContain('hand');
        expect(wrapper.find('.simulation-battlefield-zone').attributes('aria-label')).toContain('battlefield');
        expect(wrapper.find('.simulation-battlefield-creatures').attributes('aria-label')).toContain('creatures');
        expect(wrapper.find('.simulation-battlefield-lands').classes()).toContain('simulation-battlefield-column-left');
        expect(wrapper.find('.simulation-battlefield-creatures').classes()).toContain('simulation-battlefield-column-center');
        expect(wrapper.find('.simulation-battlefield-noncreatures').classes()).toContain('simulation-battlefield-column-right');
        expect(wrapper.find('.simulation-zone-stack-library .simulation-zone-count').text()).toMatch(/\d+/);
        expect(wrapper.find('.simulation-zone-stack-graveyard .simulation-zone-count').text()).toContain('0');
        expect(wrapper.find('.simulation-zone-stack-exile .simulation-zone-count').text()).toContain('0');

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Simulation board advances phase snapshots and highlights available actions.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = true;
        component.data.config.simulationPlayerDeckIds = ['current', 'phase-meta'];
        component.data.config.simulationSeed = 1;
        component.data.config.simulationTurnCount = 1;
        component.data.config.simulationPlayerCount = 2;
        component.data.config.simulationPlayerRoles = ['human', 'ai'];
        component.data.config.simulationStepIndex = 0;
        component.data.cards = [
            {
                quantity: 4,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
            {
                quantity: 4,
                name: 'burst lightning',
                selectedOption: {
                    manaValue: 1,
                    manaCost: '{R}',
                    typeLine: 'Instant',
                    oracleText: 'Burst Lightning deals 2 damage to any target.',
                    urlFront: 'burst-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'phase-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 4,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                        {
                            quantity: 4,
                            name: 'opt',
                            selectedOption: {
                                manaValue: 1,
                                typeLine: 'Instant',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.find('#simulation-current-step').text()).toContain('T1 You / Upkeep');
        expect(component.proxy.activeSimulationStep.players.find(player => player.key === 'you').zones.handCount).toBe(7);

        await wrapper.find('#simulation-next-step').trigger('click');
        expect(wrapper.find('#simulation-current-step').text()).toContain('Main');
        expect(wrapper.find('.simulation-card-actionable').exists()).toBe(true);

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
        component.data.config.simulationStepIndex = 0;
    });

    test('Feature: Simulation double click starts targeted card actions and resolves player life targets.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = true;
        component.data.config.simulationPlayerDeckIds = ['current', 'target-meta'];
        component.data.config.simulationSeed = 1;
        component.data.config.simulationTurnCount = 1;
        component.data.config.simulationPlayerCount = 2;
        component.data.config.simulationPlayerRoles = ['human', 'ai'];
        component.data.config.simulationStepIndex = 0;
        component.data.simulationLifeTotals = {};
        component.data.simulationResolvedActions = [];
        component.data.cards = [
            {
                quantity: 4,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
            {
                quantity: 4,
                name: 'burst lightning',
                selectedOption: {
                    manaValue: 1,
                    manaCost: '{R}',
                    typeLine: 'Instant',
                    oracleText: 'Burst Lightning deals 2 damage to any target.',
                    urlFront: 'burst-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'target-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();
        await wrapper.find('#simulation-next-step').trigger('click');
        await wrapper.find('#simulation-next-step').trigger('click');

        const mountainCard = wrapper.findAll('.simulation-hand-card').find(cardWrapper => {
            return cardWrapper.find('img[alt="mountain"]').exists();
        });
        expect(mountainCard).toBeTruthy();

        await mountainCard.trigger('dblclick');
        await wrapper.vm.$nextTick();

        const burstCard = wrapper.findAll('.simulation-hand-card').find(cardWrapper => {
            return cardWrapper.find('img[alt="burst lightning"]').exists();
        });
        expect(burstCard).toBeTruthy();

        await burstCard.trigger('dblclick');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.simulation-life-total-targetable').exists()).toBe(true);
        expect(wrapper.find('.simulation-targeting-banner').text()).toContain('Burst Lightning');

        const opponentLife = wrapper.find('.simulation-player-board-top .simulation-life-total');
        expect(opponentLife.text()).toBe('20');

        await opponentLife.trigger('click');
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.simulation-player-board-top .simulation-life-total').text()).toBe('18');
        expect(wrapper.find('.simulation-targeting-banner').exists()).toBe(false);
        expect(component.data.simulationResolvedActions).toHaveLength(2);

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
        component.data.config.simulationStepIndex = 0;
        component.data.simulationLifeTotals = {};
        component.data.simulationResolvedActions = [];
    });

    test('Feature: Simulation double click opens a chooser when a card has multiple legal actions.', async () => {
        const component = wrapper.getCurrentComponent();
        const modalCard = {
            name: 'modal spell',
            actionState: {
                actionable: true,
                actions: ['First mode', 'Second mode'],
                options: [
                    { id: 'first-mode', kind: 'cast', label: 'First mode', sourceZone: 'hand' },
                    { id: 'second-mode', kind: 'cast', label: 'Second mode', sourceZone: 'hand' },
                ],
            },
        };

        component.ctx.handleSimulationCardDoubleClick(modalCard, { key: 'you', name: 'You' });
        await wrapper.vm.$nextTick();

        expect(wrapper.find('#simulation-action-menu').exists()).toBe(true);
        expect(wrapper.findAll('.simulation-action-choice')).toHaveLength(2);
        expect(component.ctx.simulationActionOptionSummary({
            costs: [{ kind: 'mana', manaCost: '{R}' }],
            label: 'Use from graveyard',
            sourceZone: 'graveyard',
            targets: { required: true, targetTypes: ['player', 'creature'] },
        })).toBe('{R} \u00b7 target player/creature');
        expect(component.ctx.simulationActionOptionSummary({
            costs: [{ amount: 2, kind: 'life' }],
            label: 'Play untapped, pay 2 life',
            sourceZone: 'hand',
        })).toBe('');

        component.ctx.closeSimulationActionMenu();
        await wrapper.vm.$nextTick();
        expect(wrapper.find('#simulation-action-menu').exists()).toBe(false);

        component.data.simulationPendingAction = {
            card: modalCard,
            option: { targetTypes: ['creature'] },
        };
        const targetableCard = { name: 'otter token', typeLine: 'Token Creature - Otter' };
        expect(component.ctx.isSimulationCardTargetable(targetableCard)).toBe(true);
        expect(component.ctx.simulationCardClasses(targetableCard, true)).toMatchObject({
            'simulation-card-targetable': true,
        });
        expect(component.ctx.simulationCardClasses({
            name: 'tapped otter token',
            state: { tapped: true },
            typeLine: 'Token Creature - Otter',
        })).toMatchObject({
            'simulation-card-tapped': true,
        });
        component.data.simulationPendingAction = null;
    });

    test('Feature: Simulation attack actions mark a battlefield creature without moving zones.', () => {
        const component = wrapper.getCurrentComponent();
        const player = {
            key: 'you',
            zones: {
                battlefield: {
                    creatures: [
                        {
                            name: 'otter token',
                            quantity: 2,
                            state: {
                                summoningSick: false,
                                tapped: false,
                            },
                            typeLine: 'Token Creature - Otter',
                        },
                    ],
                    lands: [],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, top: null },
                graveyard: { cards: [], count: 0, top: null },
                hand: [],
                handCount: 0,
                playableHand: [],
            },
        };

        component.ctx.applyResolvedSimulationAction([player], {
            card: {
                name: 'otter token',
                typeLine: 'Token Creature - Otter',
            },
            option: {
                kind: 'attack',
                sourceZone: 'battlefield',
            },
            playerKey: 'you',
            stepIndex: 3,
        });

        expect(player.zones.battlefield.creatures).toContainEqual(expect.objectContaining({
            name: 'otter token',
            quantity: 1,
            state: expect.objectContaining({
                attacking: true,
                tapped: true,
            }),
        }));
        expect(player.zones.battlefield.creatures).toContainEqual(expect.objectContaining({
            name: 'otter token',
            quantity: 1,
            state: expect.objectContaining({
                tapped: false,
            }),
        }));
        expect(player.zones.battlefield.count).toBeUndefined();
    });

    test('Feature: Simulation mana actions tap lands and mana expires after the current step.', () => {
        const component = wrapper.getCurrentComponent();
        const island = {
            name: 'island',
            quantity: 1,
            state: { tapped: false },
            typeLine: 'Basic Land - Island',
        };
        const player = {
            key: 'you',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [island],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, top: null },
                graveyard: { cards: [], count: 0, top: null },
                hand: [],
                handCount: 0,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [],
            },
        };
        const action = {
            card: island,
            option: {
                kind: 'mana',
                manaProduced: ['U'],
                sourceZoneName: 'lands',
            },
            playerKey: 'you',
            stepIndex: 0,
        };

        component.ctx.applyResolvedSimulationAction([player], action);
        expect(player.zones.manaPool.U).toBe(1);
        expect(player.zones.battlefield.lands[0].state.tapped).toBe(true);

        const nextStepPlayer = {
            ...player,
            zones: component.ctx.cloneForStorage({
                ...player.zones,
                battlefield: {
                    creatures: [],
                    lands: [island],
                    nonCreaturePermanents: [],
                },
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
            }),
        };
        component.ctx.applyResolvedSimulationAction([nextStepPlayer], action, { preserveManaPool: false });
        expect(nextStepPlayer.zones.manaPool.U).toBe(0);
        expect(nextStepPlayer.zones.battlefield.lands[0].state.tapped).toBe(true);
    });

    test('Feature: Simulation resolved actions update logs, life payments, and tapped land state.', async () => {
        const component = wrapper.getCurrentComponent();
        const shockLand = {
            name: 'shock land',
            quantity: 1,
            typeLine: 'Land',
        };
        const player = {
            key: 'you',
            name: 'You',
            zones: {
                battlefield: {
                    creatures: [],
                    lands: [],
                    nonCreaturePermanents: [],
                },
                exile: { cards: [], count: 0, top: null },
                graveyard: { cards: [], count: 0, top: null },
                hand: [shockLand],
                handCount: 1,
                manaPool: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                playableHand: [shockLand],
            },
        };

        component.data.simulationLifeTotals = { you: 20 };
        component.data.simulationResolvedActions = [];
        component.ctx.resolveSimulationAction({
            card: shockLand,
            option: {
                kind: 'playLand',
                label: 'Play untapped, pay 2 life',
                lifePayment: 2,
            },
            playerKey: 'you',
            playerName: 'You',
            stepIndex: 0,
        }, null);

        expect(component.data.simulationLifeTotals.you).toBe(18);
        expect(component.ctx.simulationActionLogLines.join('\n')).toContain('Play untapped, pay 2 life: shock land');

        component.ctx.applyResolvedSimulationAction([player], {
            card: shockLand,
            option: {
                entersTapped: true,
                kind: 'playLand',
                label: 'Play tapped',
            },
            playerKey: 'you',
            stepIndex: 0,
        });
        expect(player.zones.battlefield.lands[0].state.tapped).toBe(true);

        component.data.simulationLifeTotals = {};
        component.data.simulationResolvedActions = [];
        await wrapper.vm.$nextTick();
    });

    test('Feature: Simulation AI always plays an available land before advancing.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'simulation';
        component.data.config.simulationGameStarted = true;
        component.data.config.simulationPlayerDeckIds = ['current', 'ai-meta'];
        component.data.config.simulationSeed = 1;
        component.data.config.simulationTurnCount = 1;
        component.data.config.simulationPlayerCount = 2;
        component.data.config.simulationPlayerRoles = ['human', 'ai'];
        component.data.config.simulationStepIndex = 0;
        component.data.simulationResolvedActions = [];
        component.data.cards = [
            {
                quantity: 8,
                name: 'mountain',
                selectedOption: {
                    typeLine: 'Basic Land - Mountain',
                    urlFront: 'mountain-front',
                },
            },
        ];
        component.data.metaDeckStates = [
            {
                id: 'ai-meta',
                name: 'Izzet Mirror',
                state: {
                    cards: [
                        {
                            quantity: 8,
                            name: 'island',
                            selectedOption: {
                                typeLine: 'Basic Land - Island',
                            },
                        },
                    ],
                },
            },
        ];

        await wrapper.vm.$nextTick();
        const opponentUpkeepIndex = component.ctx.gameSimulation.phaseSteps.findIndex(step => {
            return step.playerKey === 'opponent' && step.phase === 'upkeep';
        });
        component.data.config.simulationStepIndex = opponentUpkeepIndex;

        component.ctx.advanceSimulationStep();
        await wrapper.vm.$nextTick();

        expect(component.data.simulationResolvedActions).toContainEqual(expect.objectContaining({
            card: expect.objectContaining({ name: 'island' }),
            option: expect.objectContaining({ kind: 'playLand' }),
            playerKey: 'opponent',
        }));
        expect(component.ctx.simulationActionLogLines.join('\n')).toContain('Izzet Mirror / Main - Play land: island');

        component.data.config.activeWorkspaceTab = 'cards';
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
        component.data.config.simulationStepIndex = 0;
        component.data.simulationResolvedActions = [];
    });

    test('Feature: Simulation cast actions ask for a payment choice when multiple lands can pay.', async () => {
        const component = wrapper.getCurrentComponent();
        const opt = {
            name: 'opt',
            actionState: {
                actionable: true,
                actions: ['Cast instant'],
                options: [
                    {
                        id: 'cast:hand:opt',
                        kind: 'cast',
                        label: 'Cast instant',
                        paymentOptions: [
                            {
                                id: 'island',
                                label: 'Pay with island {U}',
                                poolAfterPayment: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                                sources: [
                                    {
                                        manaProduced: ['U'],
                                        name: 'island',
                                        sourceCard: { name: 'island', typeLine: 'Basic Land - Island' },
                                        zoneName: 'lands',
                                    },
                                ],
                            },
                            {
                                id: 'sanctuary',
                                label: 'Pay with mystic sanctuary {U}',
                                poolAfterPayment: { B: 0, C: 0, G: 0, R: 0, U: 0, W: 0 },
                                sources: [
                                    {
                                        manaProduced: ['U'],
                                        name: 'mystic sanctuary',
                                        sourceCard: { name: 'mystic sanctuary', typeLine: 'Land' },
                                        zoneName: 'lands',
                                    },
                                ],
                            },
                        ],
                        sourceZone: 'hand',
                    },
                ],
            },
        };

        component.ctx.handleSimulationCardDoubleClick(opt, { key: 'you', name: 'You' });
        await wrapper.vm.$nextTick();

        expect(wrapper.find('#simulation-action-menu').exists()).toBe(true);
        expect(wrapper.findAll('.simulation-action-choice').map(button => button.text())).toEqual([
            'Pay with island {U}',
            'Pay with mystic sanctuary {U}',
        ]);

        component.ctx.closeSimulationActionMenu();
        await wrapper.vm.$nextTick();
    });

    test('Feature: Analysis mode exposes meta removal action rows for damage and blocked targets.', async () => {
        const component = wrapper.getCurrentComponent();
        const shock = {
            quantity: 4,
            name: 'shock',
            selectedOption: {
                typeLine: 'Instant',
                oracleText: 'Shock deals 2 damage to any target.',
                manaCost: '{R}',
            },
        };
        const pyroclasm = {
            quantity: 2,
            name: 'pyroclasm',
            selectedOption: {
                typeLine: 'Sorcery',
                oracleText: 'Pyroclasm deals 2 damage to each creature.',
                manaCost: '{1}{R}',
            },
        };
        const hexproofCreature = {
            quantity: 3,
            name: 'slippery bogle',
            selectedOption: {
                typeLine: 'Creature - Beast',
                oracleText: 'Hexproof',
                power: '1',
                toughness: '1',
            },
        };
        const largeCreature = {
            quantity: 5,
            name: 'large creature',
            selectedOption: {
                typeLine: 'Creature - Beast',
                oracleText: '',
                power: '3',
                toughness: '3',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [shock, pyroclasm];
        component.data.metaDeckStates = [
            {
                id: 'removal-meta',
                name: 'Removal Meta',
                state: {
                    cards: [hexproofCreature, largeCreature],
                },
            },
        ];

        const column = component.proxy.analysisColumns[0];
        const blockedTargetCategory = component.proxy.analysisCategories.find(category => category.key === 'removalActions.instant.blockedTarget');
        const instantDamageCategory = component.proxy.analysisCategories.find(category => category.key === 'removalActions.instant.damage');
        const sorceryKillCategory = component.proxy.analysisCategories.find(category => category.key === 'sorceryRemoval');

        expect(component.ctx.cardAnalysisCell(shock, blockedTargetCategory, column).display).toBe('3');
        expect(component.ctx.cardAnalysisCell(shock, instantDamageCategory, column).display).toBe('5');
        expect(component.ctx.cardAnalysisCell(pyroclasm, sorceryKillCategory, column).display).toBe('3');

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Meta deck analysis headers show removal coverage and can collapse a matchup column.', async () => {
        const component = wrapper.getCurrentComponent();
        const shock = {
            quantity: 4,
            name: 'shock',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Shock deals 2 damage to any target.',
                manaCost: '{R}',
            },
        };
        const smallCreature = {
            quantity: 3,
            name: 'small creature',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Creature - Mouse',
                oracleText: '',
                power: '1',
                toughness: '2',
            },
        };
        const largeCreature = {
            quantity: 5,
            name: 'large creature',
            selectedOption: {
                manaValue: 3,
                typeLine: 'Creature - Beast',
                oracleText: '',
                power: '3',
                toughness: '3',
            },
        };
        const shoreUp = {
            quantity: 2,
            name: 'shore up',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.',
                manaCost: '{U}',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [shock];
        component.data.metaDeckStates = [
            {
                id: 'coverage-meta',
                name: 'Coverage Meta',
                state: {
                    cards: [smallCreature, largeCreature, shoreUp],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        const header = component.ctx.analysisColumnHeader(shock, component.proxy.analysisColumns[0]);
        expect(header.killPercent).toBe('30.0%');
        expect(header.interactionPercent).toBe('80.0%');
        expect(wrapper.find('.analysis-column-summary').text()).toContain('K 30.0% / I 80.0%');

        await wrapper.find('.analysis-column-toggle').trigger('click');

        expect(component.proxy.analysisColumns[0].collapsed).toBe(true);
        expect(wrapper.find('.analysis-column-collapsed').exists()).toBe(true);

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.collapsedAnalysisDeckIds = {};
        component.data.config.decklist = '';
    });

    test('Feature: Value view shows collapsible per-meta-deck battlefield removal coverage.', async () => {
        const component = wrapper.getCurrentComponent();
        const abrade = {
            quantity: 1,
            name: 'abrade',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Instant',
                oracleText: 'Choose one —\n• Abrade deals 3 damage to target creature.\n• Destroy target artifact.',
                manaCost: '{1}{R}',
            },
            setOptions: [],
        };
        const shoreUp = {
            quantity: 2,
            name: 'shore up',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.',
                manaCost: '{U}',
            },
        };
        const smallCreature = {
            quantity: 3,
            name: 'small creature',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Creature - Mouse',
                oracleText: '',
                power: '1',
                toughness: '3',
            },
        };
        const largeCreature = {
            quantity: 5,
            name: 'large creature',
            selectedOption: {
                manaValue: 4,
                typeLine: 'Creature - Beast',
                oracleText: '',
                power: '4',
                toughness: '4',
            },
        };
        const artifact = {
            quantity: 2,
            name: 'tablet',
            selectedOption: {
                manaValue: 3,
                typeLine: 'Artifact',
                oracleText: '',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [abrade];
        component.data.metaDeckStates = [
            {
                id: 'abrade-meta',
                name: 'Abrade Meta',
                state: {
                    cards: [smallCreature, largeCreature, artifact, shoreUp],
                },
            },
        ];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const coverageText = wrapper.findAll('.value-meta-removal-options')
            .map(node => node.text())
            .join(' ');
        expect(coverageText).toContain('Abrade Meta');
        expect(coverageText).toContain('Removed 25.0%');
        expect(coverageText).toContain('Damage 66.7%');
        expect(coverageText).toContain('Removed 16.7%');
        expect(coverageText).toContain('Damage 0.0%');
        expect(wrapper.find('.value-meta-removal-targets').exists()).toBe(false);

        const toggles = wrapper.findAll('.value-meta-removal-toggle');
        expect(toggles).toHaveLength(2);
        await toggles[0].trigger('click');

        expect(wrapper.find('.value-meta-removal-targets').text()).toContain('3x small creature');
        expect(wrapper.find('.value-meta-removal-targets').text()).toContain('kill');
        expect(wrapper.find('.value-meta-removal-targets').text()).toContain('2x shore up');
        expect(wrapper.find('.value-meta-removal-targets').text()).toContain('5x large creature');
        expect(wrapper.find('.value-meta-removal-targets').text()).toContain('damage');

        await toggles[1].trigger('click');
        const targetText = wrapper.findAll('.value-meta-removal-targets')
            .map(node => node.text())
            .join(' ');
        expect(targetText).toContain('2x tablet');
        expect(targetText).toContain('remove');

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.expandedValueRemovalDeckIds = {};
        component.data.config.decklist = '';
    });

    test('Feature: Mana-value analysis cells sum matching meta cards inside fixed mana columns.', async () => {
        const component = wrapper.getCurrentComponent();
        const burstLightning = {
            quantity: 1,
            name: 'burst lightning',
            selectedOption: {
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            },
        };
        const oneManaCreature = {
            quantity: 3,
            name: 'one mana target',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Creature - Mouse',
                oracleText: '',
                power: '1',
                toughness: '2',
            },
        };
        const secondOneManaCreature = {
            quantity: 2,
            name: 'second one mana target',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Creature - Rabbit',
                oracleText: '',
                power: '2',
                toughness: '2',
            },
        };
        const twoManaCreature = {
            quantity: 4,
            name: 'two mana target',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Creature - Bird',
                oracleText: 'Flying',
                power: '1',
                toughness: '3',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'manaValue';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [burstLightning];
        component.data.metaDeckStates = [
            {
                id: 'meta-one',
                name: 'Meta One',
                state: {
                    cards: [oneManaCreature, secondOneManaCreature, twoManaCreature],
                },
            },
        ];

        const columns = component.proxy.analysisColumns;
        const oneManaColumn = columns.find(column => column.key === '1');
        const ninePlusColumn = columns.find(column => column.key === '9-plus');
        const cell = component.ctx.cardAnalysisCell(
            burstLightning,
            component.proxy.analysisCategories[0],
            oneManaColumn,
        );

        expect(columns.map(column => column.label)).toEqual([
            '0 mana',
            '1 mana',
            '2 mana',
            '3 mana',
            '4 mana',
            '5 mana',
            '6 mana',
            '7 mana',
            '8 mana',
            '9+ mana',
        ]);
        expect(cell.display).toBe('5');
        expect(cell.title).toContain('3x one mana target');
        expect(cell.title).toContain('2x second one mana target');
        expect(ninePlusColumn.creatures).toEqual([]);

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Analysis percentages use the selected meta deck card total.', async () => {
        const component = wrapper.getCurrentComponent();
        const burstLightning = {
            quantity: 1,
            name: 'burst lightning',
            selectedOption: {
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            },
        };
        const targetCreature = {
            quantity: 5,
            name: 'target creature',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Creature - Mouse',
                oracleText: '',
                power: '1',
                toughness: '2',
            },
        };
        const otherCard = {
            quantity: 55,
            name: 'other card',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Instant',
                oracleText: 'Draw a card.',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'percent';
        component.data.config.analysisColumnMode = 'manaValue';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [burstLightning];
        component.data.metaDeckStates = [
            {
                id: 'meta-percent',
                name: 'Meta Percent',
                state: {
                    cards: [targetCreature, otherCard],
                },
            },
        ];

        const cell = component.ctx.cardAnalysisCell(
            burstLightning,
            component.proxy.analysisCategories[0],
            component.proxy.analysisColumns.find(column => column.key === '1'),
        );

        expect(cell.display).toBe('8.3%');

        component.data.config.analysisMode = false;
        component.data.config.analysisMetric = 'count';
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Analysis card rows show loading indicators while stats data loads.', async () => {
        const component = wrapper.getCurrentComponent();
        const analyzedCard = {
            quantity: 1,
            name: 'burst lightning',
            selectedOption: {
                typeLine: 'Instant',
                oracleText: 'Burst Lightning deals 2 damage to any target.',
            },
            setOptions: [],
        };

        component.data.config.analysisMode = true;
        component.data.cards = [analyzedCard];
        component.data.isLoadingSessions = true;
        component.data.metaDeckStates = [
            {
                id: 'meta-loading',
                name: 'Meta Loading',
                state: {
                    cards: [],
                },
            },
        ];

        await wrapper.vm.$nextTick();

        expect(wrapper.findAll('.analysis-card-stat-loader')).toHaveLength(1);

        component.data.isLoadingSessions = false;
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Deck import publishes card shells before dataset hydration completes.', async () => {
        const component = wrapper.getCurrentComponent();
        const originalGetScryfallDataset = component.ctx.getScryfallDataset;
        let resolveDataset;

        component.ctx.getScryfallDataset = () => {
            return new Promise(resolve => {
                resolveDataset = resolve;
            });
        };
        component.data.config.decklist = '1 Lightning Bolt';

        const loadPromise = component.ctx.loadCardList();
        await wrapper.vm.$nextTick();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(component.data.cards).toHaveLength(1);
        expect(component.data.cards[0].name).toBe('lightning bolt');
        expect(component.data.cards[0].selectedOption).toBe(null);
        expect(component.ctx.isCardHydrating(component.data.cards[0])).toBe(true);

        resolveDataset({
            sets: {
                lea: 'Limited Edition Alpha',
            },
            cards: {
                'lightning bolt': [
                    {
                        setCode: 'lea',
                        collectorNumber: '161',
                        urlFront: 'bolt-front',
                        typeLine: 'Instant',
                        oracleText: 'Lightning Bolt deals 3 damage to any target.',
                        manaCost: '{R}',
                        manaValue: 1,
                    },
                ],
            },
        });
        await loadPromise;

        expect(component.data.cards[0].selectedOption.urlFront).toBe('bolt-front');
        expect(component.ctx.isCardHydrating(component.data.cards[0])).toBe(false);

        component.ctx.getScryfallDataset = originalGetScryfallDataset;
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Analysis mode hides empty rows and shows typed synergy rows with trigger costs.', async () => {
        const component = wrapper.getCurrentComponent();
        const stormchaserTalent = {
            quantity: 1,
            name: "stormchaser's talent",
            selectedOption: {
                manaValue: 1,
                typeLine: 'Enchantment - Class',
                oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.\n{3}{U}: Level 2\nWhen this Class becomes level 2, return target instant or sorcery card from your graveyard to your hand.\n{5}{U}: Level 3\nWhenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
                manaCost: '{U}',
                relatedTokens: [
                    {
                        name: 'otter',
                        typeLine: 'Token Creature - Otter',
                        oracleText: 'Prowess',
                        power: '1',
                        toughness: '1',
                    },
                ],
            },
            setOptions: [],
        };
        const opt = {
            quantity: 4,
            name: 'opt',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Scry 1. Draw a card.',
                manaCost: '{U}',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [stormchaserTalent];
        component.data.metaDeckStates = [
            {
                id: 'synergy-meta',
                name: 'Synergy Meta',
                state: {
                    cards: [opt],
                },
            },
        ];

        const visibleLabels = component.ctx.visibleAnalysisCategories(stormchaserTalent).map(category => category.label);
        const cell = component.ctx.cardAnalysisCell(
            stormchaserTalent,
            component.proxy.analysisCategories.find(category => category.key === 'synergy.combat.sources'),
            component.proxy.analysisColumns[0],
        );

        expect(visibleLabels).not.toContain('Synergy combat');
        expect(visibleLabels).toContain('S:Grave to hand');
        expect(visibleLabels).toContain('S:Token engine');
        expect(visibleLabels).not.toContain('Feeds grave');
        expect(visibleLabels).not.toContain('Kill inst.');
        expect(cell.display).toBe('-');
        expect(cell.title).toBe('');

        const graveCell = component.ctx.cardAnalysisCell(
            stormchaserTalent,
            component.proxy.analysisCategories.find(category => category.key === 'synergy.graveyardPlay.sources'),
            component.proxy.analysisColumns[0],
        );
        const tokenCell = component.ctx.cardAnalysisCell(
            stormchaserTalent,
            component.proxy.analysisCategories.find(category => category.key === 'synergy.creatureTokens.sources'),
            component.proxy.analysisColumns[0],
        );

        expect(graveCell.title).toContain('4x opt - S:Grave to hand cost 5');
        expect(tokenCell.title).toContain('4x opt - S:Token engine cost 11');

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Mana-value synergy columns use action cost instead of card mana value.', async () => {
        const component = wrapper.getCurrentComponent();
        const opt = {
            quantity: 1,
            name: 'opt',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Scry 1. Draw a card.',
                manaCost: '{U}',
            },
            setOptions: [],
        };
        const stormchaserTalent = {
            quantity: 4,
            name: "stormchaser's talent",
            selectedOption: {
                manaValue: 1,
                typeLine: 'Enchantment - Class',
                oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.\n{3}{U}: Level 2\nWhen this Class becomes level 2, return target instant or sorcery card from your graveyard to your hand.\n{5}{U}: Level 3\nWhenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
                manaCost: '{U}',
                relatedTokens: [
                    {
                        name: 'otter',
                        typeLine: 'Token Creature - Otter',
                        oracleText: 'Prowess',
                        power: '1',
                        toughness: '1',
                    },
                ],
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'manaValue';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [opt];
        component.data.metaDeckStates = [
            {
                id: 'stormchaser-meta',
                name: 'Stormchaser Meta',
                state: {
                    cards: [stormchaserTalent],
                },
            },
        ];

        const graveCategory = component.proxy.analysisCategories.find(category => category.key === 'synergy.graveyardPlay.feeders');
        const tokenCategory = component.proxy.analysisCategories.find(category => category.key === 'synergy.creatureTokens.feeders');
        const oneManaColumn = component.proxy.analysisColumns.find(column => column.key === '1');
        const fiveManaColumn = component.proxy.analysisColumns.find(column => column.key === '5');
        const ninePlusColumn = component.proxy.analysisColumns.find(column => column.key === '9-plus');

        expect(component.ctx.cardAnalysisCell(opt, graveCategory, oneManaColumn).display).toBe('-');
        expect(component.ctx.cardAnalysisCell(opt, graveCategory, fiveManaColumn).display).toBe('4');
        expect(component.ctx.cardAnalysisCell(opt, tokenCategory, ninePlusColumn).display).toBe('4');

        component.data.config.analysisMode = false;
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Value view renders cast and permanent options as structured value rows.', async () => {
        const component = wrapper.getCurrentComponent();
        const opt = {
            quantity: 1,
            name: 'opt',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Scry 1. Draw a card.',
                manaCost: '{U}',
            },
            setOptions: [],
        };
        const stormchaserTalent = {
            quantity: 4,
            name: "stormchaser's talent",
            selectedOption: {
                manaValue: 1,
                typeLine: 'Enchantment - Class',
                oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.\n{3}{U}: Level 2\nWhen this Class becomes level 2, return target instant or sorcery card from your graveyard to your hand.\n{5}{U}: Level 3\nWhenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
                manaCost: '{U}',
                relatedTokens: [
                    {
                        name: 'otter',
                        typeLine: 'Token Creature - Otter',
                        oracleText: 'Prowess',
                        power: '1',
                        toughness: '1',
                    },
                ],
            },
        };
        const otter = {
            quantity: 1,
            name: 'otter',
            selectedOption: {
                manaValue: 0,
                typeLine: 'Token Creature - Otter',
                oracleText: 'Prowess',
                power: '1',
                toughness: '1',
                isToken: true,
                isGamePiece: true,
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [opt, stormchaserTalent, otter];
        component.data.metaDeckStates = [
            {
                id: 'value-meta',
                name: 'Value Meta',
                state: {
                    cards: [],
                },
            },
        ];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const valueText = wrapper.find('.value-view').text();
        expect(valueText).toContain('Cast');
        expect(valueText).toContain('Scry 1, Draw 1');
        expect(valueText).toContain('Card quality improvement');
        expect(valueText).not.toContain('Card 0');
        expect(wrapper.find('.value-row-base .ms-u').exists()).toBe(true);
        expect(wrapper.find('.value-row-base .ms-instant').exists()).toBe(true);
        expect(wrapper.find('.value-rows-permanent').text()).not.toContain("stormchaser's talent class 1");
        expect(wrapper.find('.value-rows-permanent').text()).toContain('otter');
        expect(wrapper.find('.value-rows-permanent').text()).toContain('Combat pump +1/+1 UED');
        expect(wrapper.find('.value-rows-permanent').text()).toContain('Creature improvement');
        expect(wrapper.find('.value-rows-permanent').text()).not.toContain('Grave to hand');
        expect(wrapper.find('.value-rows-permanent .ms-u').exists()).toBe(true);
        expect(wrapper.find('.value-rows-permanent .ms-1').exists()).toBe(false);
        expect(wrapper.find('.value-rows-permanent .ms-instant').exists()).toBe(false);
        expect(wrapper.find('.value-zone-options').text()).toContain('Zone movement');
        expect(wrapper.find('.value-zone-options').text()).toContain("stormchaser's talent class 2");
        expect(wrapper.find('.value-zone-options').text()).toContain('Grave to hand');
        expect(wrapper.find('.value-zone-options').text()).toContain('Card recursion');
        expect(wrapper.find('.value-zone-options .ms-u').exists()).toBe(true);
        expect(wrapper.find('.value-zone-options .ms-3').exists()).toBe(true);
        expect(wrapper.find('.value-zone-options .ms-5').exists()).toBe(false);
        expect(wrapper.find('.value-rows-bonus').exists()).toBe(false);

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Value view uses the current deck for synergies instead of meta decks.', async () => {
        const component = wrapper.getCurrentComponent();
        const opt = {
            quantity: 1,
            name: 'opt',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Scry 1. Draw a card.',
                manaCost: '{U}',
            },
            setOptions: [],
        };
        const stormchaserTalent = {
            quantity: 4,
            name: "stormchaser's talent",
            selectedOption: {
                manaValue: 1,
                typeLine: 'Enchantment - Class',
                oracleText: 'Whenever you cast an instant or sorcery spell, create a 1/1 Otter creature token with prowess.',
                manaCost: '{U}',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [opt];
        component.data.metaDeckStates = [
            {
                id: 'izzet-meta',
                name: 'Izzet Prowess',
                state: {
                    cards: [stormchaserTalent],
                },
            },
        ];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.value-rows-permanent').exists()).toBe(false);
        expect(wrapper.find('.value-view').text()).not.toContain("stormchaser's talent");

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Value view renders mana sources as compact chips at the bottom.', async () => {
        const component = wrapper.getCurrentComponent();
        while(!component.data.activeSessionId) {
            await new Promise(r => setTimeout(r, 50));
        }

        const opt = {
            quantity: 1,
            name: 'opt',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Scry 1. Draw a card.',
                manaCost: '{U}',
            },
            setOptions: [],
        };
        const island = {
            quantity: 5,
            name: 'island',
            selectedOption: {
                manaValue: 0,
                typeLine: 'Basic Land - Island',
                oracleText: '{T}: Add {U}.',
                manaCost: '',
            },
            setOptions: [],
        };
        const riverpyre = {
            quantity: 2,
            name: 'riverpyre verge',
            selectedOption: {
                manaValue: 0,
                typeLine: 'Land',
                oracleText: '{T}: Add {U} or {R}.',
                manaCost: '',
            },
            setOptions: [],
        };
        const arcaneSignet = {
            quantity: 1,
            name: 'arcane signet',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Artifact',
                oracleText: '{T}: Add one mana of any color.',
                manaCost: '{2}',
            },
            setOptions: [],
        };
        const mountain = {
            quantity: 3,
            name: 'mountain',
            selectedOption: {
                manaValue: 0,
                typeLine: 'Basic Land - Mountain',
                oracleText: '{T}: Add {R}.',
                manaCost: '',
            },
            setOptions: [],
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [opt, island, riverpyre, arcaneSignet, mountain];
        component.data.metaDeckStates = [];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const manaSources = wrapper.find('.value-mana-options');
        expect(manaSources.text()).toContain('Mana sources');
        expect(manaSources.text()).toContain('island');
        expect(manaSources.text()).toContain('riverpyre verge');
        expect(manaSources.text()).toContain('x5');
        expect(manaSources.text()).toContain('/');
        expect(manaSources.text()).not.toContain('mountain');
        expect(wrapper.find('.value-mana-chip .ms-u').exists()).toBe(true);
        expect(wrapper.find('.value-mana-chip-land-payment').exists()).toBe(true);
        expect(wrapper.find('.value-mana-choice-separator').exists()).toBe(true);
        expect(manaSources.find('.value-rows-mana').text()).toContain('arcane signet');
        expect(manaSources.find('.value-row-mana').exists()).toBe(true);
        expect(wrapper.find('.value-cast .value-rows-mana').exists()).toBe(false);

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Value view separates opponent bounce from own permanent bounce draw.', async () => {
        const component = wrapper.getCurrentComponent();
        const boomerang = {
            quantity: 1,
            name: 'boomerang',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Instant',
                oracleText: "Return target permanent to its owner's hand.",
                manaCost: '{U}{U}',
            },
            setOptions: [],
        };
        const arcaneSignet = {
            quantity: 1,
            name: 'arcane signet',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Artifact',
                oracleText: "{T}: Add one mana of any color in your commander's color identity.",
                manaCost: '{2}',
            },
            setOptions: [],
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [boomerang, arcaneSignet];
        component.data.metaDeckStates = [];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const zoneText = wrapper.find('.value-zone-options').text();
        expect(zoneText).toContain('Opponent permanent');
        expect(zoneText).toContain('Battlefield to hand');
        expect(zoneText).toContain('arcane signet');
        expect(zoneText).toContain('Battlefield to hand + draw');
        expect(zoneText).toContain('Card draw');

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Value view renders creature modifier options from the current deck.', async () => {
        const component = wrapper.getCurrentComponent();
        const elemental = {
            quantity: 1,
            name: 'elemental token',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Creature - Elemental',
                oracleText: '',
                manaCost: '{1}{R}',
                power: '2',
                toughness: '2',
            },
            setOptions: [],
        };
        const waterbending = {
            quantity: 1,
            name: 'waterbending technique',
            selectedOption: {
                manaValue: 1,
                typeLine: 'Instant',
                oracleText: 'Choose one — Target creature has base power and toughness 1/1 until end of turn and gains hexproof until end of turn; or target creature has base power and toughness 3/4 until end of turn and gains flying and vigilance until end of turn.',
                manaCost: '{U}',
            },
            setOptions: [],
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [elemental, waterbending];
        component.data.metaDeckStates = [];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const modifierRows = wrapper.find('.value-creature-options');
        expect(modifierRows.text()).toContain('Creature modifiers');
        expect(modifierRows.text()).toContain('Become 1/1 with hexproof');
        expect(modifierRows.text()).toContain('Become 3/4 with flying and vigilance');
        expect(wrapper.find('.value-row-creature .ms-u').exists()).toBe(true);
        expect(wrapper.find('.value-row-creature .ms-instant').exists()).toBe(true);

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.cards = [];
        component.data.config.decklist = '';
    });

    test('Feature: Value view renders activated ability rows for permanents.', async () => {
        const component = wrapper.getCurrentComponent();
        const greatHall = {
            quantity: 1,
            name: 'great hall of the biblioplex',
            selectedOption: {
                manaValue: 0,
                typeLine: 'Land',
                oracleText: '{T}: Add {C}.\n{5}: If this land isn\'t a creature, it becomes a 2/4 Wizard creature with "Whenever you cast an instant or sorcery spell, this creature gets +1/+0 until end of turn."',
                manaCost: '',
            },
            setOptions: [],
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisView = 'value';
        component.data.config.includeCards = true;
        component.data.config.includeGamePieces = true;
        component.data.cards = [greatHall];

        await component.ctx.waitForAnalysisQueue();
        await wrapper.vm.$nextTick();

        const activatedRows = wrapper.find('.value-rows-activated');
        expect(wrapper.find('.value-activated-options').text()).toContain('Activated abilities');
        expect(activatedRows.text()).toContain('Add {C}');
        expect(activatedRows.text()).toContain('Mana production');
        expect(activatedRows.text()).toContain('Become 2/4 Wizard creature');
        expect(activatedRows.text()).toContain('Creature conversion; Creature improvement');
        expect(activatedRows.find('.ms-tap').exists()).toBe(true);

        component.data.config.analysisView = 'interaction';
        component.data.config.analysisMode = false;
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Bounce synergy rows identify permanents and ETB recast targets.', async () => {
        const component = wrapper.getCurrentComponent();
        const boomerang = {
            quantity: 1,
            name: 'boomerang',
            selectedOption: {
                manaValue: 2,
                typeLine: 'Instant',
                oracleText: "Return target permanent to its owner's hand.",
                manaCost: '{U}{U}',
            },
            setOptions: [],
        };
        const stormchaserTalent = {
            quantity: 2,
            name: "stormchaser's talent",
            selectedOption: {
                manaValue: 1,
                typeLine: 'Enchantment - Class',
                oracleText: 'When this Class enters, create a 1/1 Otter creature token with prowess.',
                manaCost: '{U}',
            },
        };

        component.data.config.analysisMode = true;
        component.data.config.analysisMetric = 'count';
        component.data.config.analysisColumnMode = 'metaDeck';
        component.data.config.analysisMatchupSessionId = 'all';
        component.data.cards = [boomerang];
        component.data.metaDeckStates = [
            {
                id: 'bounce-meta',
                name: 'Bounce Meta',
                state: {
                    cards: [stormchaserTalent],
                },
            },
        ];

        const visibleLabels = component.ctx.visibleAnalysisCategories(boomerang).map(category => category.label);
        const handCell = component.ctx.cardAnalysisCell(
            boomerang,
            component.proxy.analysisCategories.find(category => category.key === 'synergy.battlefieldToHand.sources'),
            component.proxy.analysisColumns[0],
        );
        const etbCell = component.ctx.cardAnalysisCell(
            boomerang,
            component.proxy.analysisCategories.find(category => category.key === 'synergy.entersBattlefield.sources'),
            component.proxy.analysisColumns[0],
        );

        expect(visibleLabels).toContain('Synergy hand');
        expect(visibleLabels).toContain('Synergy ETB');
        expect(handCell.title).toContain("2x stormchaser's talent - I:Battlefield to hand cost 2");
        expect(etbCell.title).toContain("2x stormchaser's talent - I:ETB recast cost 3");

        component.data.config.analysisMode = false;
        component.data.metaDeckStates = [];
        component.data.config.decklist = '4 Wild Nacatl';
        await component.ctx.loadCardList();
    });

    test('Feature: Local app startup restores the first saved session from storage.', async () => {
        globalThis.__resetLocalSessions();
        globalThis.__localSessionStore.sessions.push({
            id: 'saved-session',
            name: 'Saved Local Deck',
            updatedAt: new Date().toISOString(),
            state: {
                config: {
                    decklist: '1 Saved Card',
                    includeCards: false,
                    includeGamePieces: true,
                },
                cards: [
                    {
                        quantity: 1,
                        name: 'saved card',
                        isBasic: false,
                        selectedOption: { urlFront: 'saved-front' },
                    },
                ],
                errors: [],
                sessionSetSelections: {},
                printOrderIndexes: [],
                nextTokenBackIndex: 0,
            },
        });

        const restoredWrapper = mount(ProxyPage, {
            mocks: {
                $t: () => {},
            },
        });
        const component = restoredWrapper.getCurrentComponent();

        while(component.data.activeSessionId !== 'saved-session') {
            await new Promise(r => setTimeout(r, 50));
        }

        expect(component.data.activeSessionName).toBe('Saved Local Deck');
        expect(component.data.config.decklist).toBe('1 Saved Card');
        expect(component.data.cards[0].name).toBe('saved card');

        restoredWrapper.unmount();
    });
});

describe('Deck Loading', async () => {
    await wrapper.find('#deck-input').setValue('4 Wild Nacatl');
    await wrapper.find('#submit-decklist').trigger('click');

    test('Properties', () => {
        const cards = wrapper.getCurrentComponent().data.cards;
        // console.log(JSON.stringify(cards[0]));
        expect(cards.length).toBe(1);
        expect(cards[0].quantity).toBe(4);
        expect(cards[0].name).toBe('wild nacatl');
    });

    test('Has Card Entry', () => {
        expect(wrapper.findAll('.card-select').length).toBe(1);
    })

    test('Feature: Advanced print order opens a page-shaped grid and swaps two print slots.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'print';
        component.data.config.analysisMode = false;
        component.data.cards = [
            {
                quantity: 1,
                name: 'alpha',
                isBasic: false,
                selectedOption: { urlFront: 'alpha-front' },
            },
            {
                quantity: 1,
                name: 'bravo',
                isBasic: false,
                selectedOption: { urlFront: 'bravo-front' },
            },
            {
                quantity: 1,
                name: 'charlie',
                isBasic: false,
                selectedOption: { urlFront: 'charlie-front' },
            },
        ];
        component.data.config.fixedPageSize = true;
        component.data.config.cardsPerPage = null;
        await wrapper.vm.$nextTick();

        await wrapper.find('#open-print-order').trigger('click');

        expect(wrapper.find('#print-order-modal').exists()).toBe(true);
        expect(component.ctx.printOrderGridColumns).toBe(3);
        expect(component.ctx.printOrderPreviewPages[0].slots.length).toBe(9);

        const slots = wrapper.findAll('.print-order-slot');
        await slots[0].trigger('click');

        expect(component.data.selectedPrintOrderSlotIndex).toBe(0);
        expect(slots[0].classes()).toContain('print-order-slot-selected');

        await slots[2].trigger('click');

        expect(component.data.printOrderDraftCards.map(card => card.name)).toEqual(['charlie', 'bravo', 'alpha']);
        expect(component.ctx.printSlotsFront.map(card => card.name)).toEqual(['alpha', 'bravo', 'charlie']);
        expect(component.data.cards.map(card => card.name)).toEqual(['alpha', 'bravo', 'charlie']);
        expect(component.data.selectedPrintOrderSlotIndex).toBe(null);
        expect(component.data.printOrderModalOpen).toBe(true);

        await wrapper.find('#apply-print-order').trigger('click');

        expect(component.data.printOrderModalOpen).toBe(false);
        expect(component.ctx.printSlotsFront.map(card => card.name)).toEqual(['charlie', 'bravo', 'alpha']);

        component.ctx.resetPrintOrder();
    });

    test('Feature: Applied advanced print order is used when print is clicked.', async () => {
        const component = wrapper.getCurrentComponent();
        const originalPrint = window.print;
        const printedOrders = [];

        window.print = () => {
            printedOrders.push(component.ctx.printPages[0].slots.map(slot => slot.card.name));
        };

        component.data.config.cardBacks = 'dfc';
        component.data.config.fixedPageSize = false;
        component.data.config.cardsPerPage = null;
        component.data.cards = [
            {
                quantity: 1,
                name: 'alpha',
                isBasic: false,
                selectedOption: { urlFront: 'alpha-front' },
            },
            {
                quantity: 1,
                name: 'bravo',
                isBasic: false,
                selectedOption: { urlFront: 'bravo-front' },
            },
            {
                quantity: 1,
                name: 'charlie',
                isBasic: false,
                selectedOption: { urlFront: 'charlie-front' },
            },
        ];

        component.ctx.openPrintOrderModal();
        component.ctx.selectPrintOrderSlot(0);
        component.ctx.selectPrintOrderSlot(2);
        component.ctx.applyPrintOrder();
        component.ctx.printList();

        expect(printedOrders).toEqual([['charlie', 'bravo', 'alpha']]);

        window.print = originalPrint;
        component.ctx.resetPrintOrder();
    });

    test('Feature: Applying advanced print order disables automatic token placement for opposite backs.', () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.cardBacks = 'all-pages';
        component.data.config.tokenBackMode = 'opposite';
        component.data.config.tokenPlacementMode = 'auto';
        component.data.config.fixedPageSize = true;
        component.data.config.cardsPerPage = null;
        component.data.cards = [
            {
                quantity: 2,
                name: 'treasure',
                isBasic: false,
                selectedOption: { setCode: 'tfin', collectorNumber: '1', urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
            {
                quantity: 1,
                name: 'pest',
                isBasic: false,
                selectedOption: { setCode: 'tsos', collectorNumber: '9', urlFront: 'pest-front', isToken: true, isGamePiece: true },
            },
        ];

        component.ctx.openPrintOrderModal();
        component.ctx.selectPrintOrderSlot(1);
        component.ctx.selectPrintOrderSlot(2);
        component.ctx.applyPrintOrder();

        const pages = component.ctx.printPages;
        const frontNames = pages[0].slots.filter(Boolean).map(slot => slot.card.name);
        const backNames = pages[1].slots.filter(Boolean).map(slot => slot.card.name);

        expect(component.data.config.tokenPlacementMode).toBe('chosen');
        expect(frontNames).toEqual(['treasure', 'treasure']);
        expect(backNames).toEqual(['pest']);

        component.data.config.tokenPlacementMode = 'auto';
        component.ctx.resetPrintOrder();
    });

    test('Feature: Advanced print order preview matches opposite-side token print pages.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'print';
        component.data.config.analysisMode = false;
        component.data.config.cardBacks = 'all-pages';
        component.data.config.tokenBackMode = 'opposite';
        component.data.config.tokenPlacementMode = 'auto';
        component.data.config.fixedPageSize = true;
        component.data.config.cardsPerPage = null;
        component.data.cards = [
            {
                quantity: 2,
                name: 'treasure',
                isBasic: false,
                selectedOption: { setCode: 'tfin', collectorNumber: '1', urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
            {
                quantity: 1,
                name: 'pest',
                isBasic: false,
                selectedOption: { setCode: 'tsos', collectorNumber: '9', urlFront: 'pest-front', isToken: true, isGamePiece: true },
            },
        ];
        await wrapper.vm.$nextTick();

        await wrapper.find('#open-print-order').trigger('click');

        let previewPages = component.ctx.printOrderPreviewPages;
        expect(previewPages[0].slots.filter(slot => slot.card).map(slot => slot.card.name)).toEqual(['treasure', 'pest']);
        expect(previewPages[1].isBack).toBe(true);
        expect(wrapper.find('.print-order-grid-backs').exists()).toBe(true);

        const slots = wrapper.findAll('.print-order-slot');
        await slots[9].trigger('click');
        await slots[1].trigger('click');

        previewPages = component.ctx.printOrderPreviewPages;
        const previewFrontNames = previewPages[0].slots.filter(slot => slot.card).map(slot => slot.card.name);
        const previewBackNames = previewPages[1].slots.filter(slot => slot.card).map(slot => slot.card.name);

        await wrapper.find('#apply-print-order').trigger('click');

        const printPages = component.ctx.printPages;
        const printFrontNames = printPages[0].slots.filter(slot => slot?.card).map(slot => slot.card.name);
        const printBackNames = printPages[1].slots.filter(slot => slot?.card).map(slot => slot.card.name);

        expect(previewFrontNames).toEqual(printFrontNames);
        expect(previewBackNames).toEqual(printBackNames);

        component.data.config.tokenPlacementMode = 'auto';
        component.ctx.resetPrintOrder();
    });

    test('Feature: Advanced print order grid dimensions match the configured page size.', () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.fixedPageSize = false;

        component.data.config.cardsPerPage = 8;
        expect(component.ctx.printOrderGridColumns).toBe(2);

        component.data.config.cardsPerPage = 6;
        expect(component.ctx.printOrderGridColumns).toBe(3);

        component.data.config.fixedPageSize = false;
        component.data.config.cardsPerPage = null;
    });

    test('Feature: Related combo piece config is collapsible while generation stays available.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'deck';
        component.data.config.analysisMode = false;
        component.data.config.comboPieceConfigOpen = false;
        await wrapper.vm.$nextTick();

        expect(wrapper.find('#generate-combo-pieces').exists()).toBe(true);
        expect(wrapper.find('#combo-piece-config').exists()).toBe(false);

        await wrapper.find('#toggle-combo-piece-config').trigger('click');

        expect(wrapper.find('#generate-combo-pieces').exists()).toBe(true);
        expect(wrapper.find('#combo-piece-config').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-token"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-tracker"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-mechanic-helper"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-dungeon"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-initiative"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-ring"]').exists()).toBe(true);
        expect(wrapper.find('input[name="combo-piece-real-card"]').exists()).toBe(true);
    });

    test('Feature: Print content type filters are exposed beside the basic land filter.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.activeWorkspaceTab = 'print';
        component.data.config.analysisMode = false;
        await wrapper.vm.$nextTick();

        expect(wrapper.find('input[name="include-cards"]').exists()).toBe(true);
        expect(wrapper.find('input[name="include-game-pieces"]').exists()).toBe(true);
    });

    test('Feature: Bracketed set code selects token printing.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = 'Pest [tsos]';
        await component.ctx.loadCardList();

        const cards = component.data.cards;

        expect(cards.length).toBe(1);
        expect(cards[0].name).toBe('pest');
        expect(cards[0].selectedOption.isToken).toBe(true);
        expect(cards[0].selectedOption.isGamePiece).toBe(true);
        expect(cards[0].selectedOption.setCode).toBe('tsos');
    });

    test('Feature: Bracketed set code and collector number select exact token printing.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = 'Pest [tsos] 9';
        await component.ctx.loadCardList();

        const cards = component.data.cards;

        expect(cards.length).toBe(1);
        expect(cards[0].name).toBe('pest');
        expect(cards[0].selectedOption.isToken).toBe(true);
        expect(cards[0].selectedOption.isGamePiece).toBe(true);
        expect(cards[0].selectedOption.setCode).toBe('tsos');
        expect(cards[0].selectedOption.collectorNumber).toBe('9');
    });

    test('Feature: Associated session cards complete missing token edition text.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = `
            Pestbrood Sloth
            Pest
        `;
        await component.ctx.loadCardList();

        const cards = component.data.cards;
        const pest = cards.find(card => card.name === 'pest');

        expect(pest.selectedOption.isToken).toBe(true);
        expect(pest.selectedOption.setCode).toBe('tsos');
        expect(pest.selectedOption.collectorNumber).toBe('9');
    });

    test('Feature: Associated session cards complete missing token collector number only.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = `
            Pestbrood Sloth
            Pest [tsos]
        `;
        await component.ctx.loadCardList();

        const cards = component.data.cards;
        const pest = cards.find(card => card.name === 'pest');

        expect(pest.selectedOption.isToken).toBe(true);
        expect(pest.selectedOption.setCode).toBe('tsos');
        expect(pest.selectedOption.collectorNumber).toBe('9');
    });

    test('Feature: Associated session cards preserve complete token edition text.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = `
            Pestbrood Sloth
            Pest [tsos] 8
        `;
        await component.ctx.loadCardList();

        const cards = component.data.cards;
        const pest = cards.find(card => card.name === 'pest');

        expect(pest.selectedOption.isToken).toBe(true);
        expect(pest.selectedOption.setCode).toBe('tsos');
        expect(pest.selectedOption.collectorNumber).toBe('8');
    });

    test('Feature: Session token selections are preserved over associated token completion.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.sessionSetSelections.pest = [
            {
                name: 'Secrets of Strixhaven Tokens (8)',
                setCode: 'tsos',
                collectorNumber: '8',
                isToken: true,
                urlFront: 'selected-token',
            },
        ];
        component.data.config.decklist = `
            Pestbrood Sloth
            Pest
        `;
        await component.ctx.loadCardList();

        const cards = component.data.cards;
        const pest = cards.find(card => card.name === 'pest');

        expect(pest.selectedOption.collectorNumber).toBe('8');

        component.data.sessionSetSelections.pest = undefined;
    });

    test('Feature: Flavor name imports resolve to original card printings.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.matchEditions = false;
        component.data.config.decklist = "Aang's Shelter";
        await component.ctx.loadCardList();

        const cards = component.data.cards;

        expect(cards.length).toBe(1);
        expect(cards[0].name).toBe("aang's shelter");
        expect(cards[0].selectedOption.setCode).toBe('tle');
        expect(cards[0].selectedOption.collectorNumber).toBe('7');
    });

    test('Feature: Related combo piece generation appends missing selected piece types.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.comboPieceTypes.token = true;
        component.data.config.comboPieceTypes.emblem = false;
        component.data.config.comboPieceTypes.tracker = false;
        component.data.config.comboPieceTypes.mechanicHelper = false;
        component.data.config.comboPieceTypes.dungeon = false;
        component.data.config.comboPieceTypes.initiative = false;
        component.data.config.comboPieceTypes.ring = false;
        component.data.config.comboPieceTypes.realCard = false;
        component.data.config.decklist = 'Pestbrood Sloth';
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).toContain('Pest [tsos] 9');
        expect(component.data.cards.some(card => card.name === 'pest')).toBe(true);
    });

    test('Feature: Related combo piece generation skips disabled types and existing pieces.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.comboPieceTypes.token = false;
        component.data.config.comboPieceTypes.emblem = false;
        component.data.config.comboPieceTypes.tracker = true;
        component.data.config.comboPieceTypes.mechanicHelper = false;
        component.data.config.comboPieceTypes.dungeon = false;
        component.data.config.comboPieceTypes.initiative = false;
        component.data.config.comboPieceTypes.ring = false;
        component.data.config.comboPieceTypes.realCard = false;
        component.data.config.decklist = `
            Pestbrood Sloth
            Pest [tsos] 8
            Katara, Waterbending Master
        `;
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        const parsedLines = component.data.config.decklist
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        expect(parsedLines.filter(line => /^Pest\b/i.test(line)).length).toBe(1);
        expect(component.data.config.decklist).toContain('Experience [ttdc] 34');
    });

    test('Feature: Related combo piece generation can import dungeon, initiative, and ring pieces separately.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.comboPieceTypes.token = false;
        component.data.config.comboPieceTypes.emblem = false;
        component.data.config.comboPieceTypes.tracker = false;
        component.data.config.comboPieceTypes.mechanicHelper = false;
        component.data.config.comboPieceTypes.dungeon = true;
        component.data.config.comboPieceTypes.initiative = true;
        component.data.config.comboPieceTypes.ring = true;
        component.data.config.comboPieceTypes.realCard = false;
        component.data.config.decklist = `
            Sefris of the Hidden Ways
            Goliath Paladin
            Frodo, Adventurous Hobbit
        `;
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).toContain('Dungeon of the Mad Mage [tafr] 20');
        expect(component.data.config.decklist).toContain('Undercity // The Initiative [tclb] 20');
        expect(component.data.config.decklist).toContain('The Ring // The Ring Tempts You [tltr] H13');
    });

    test('Feature: Related real-card combo pieces are one-way from source cards to their helper card.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.comboPieceTypes.token = false;
        component.data.config.comboPieceTypes.emblem = false;
        component.data.config.comboPieceTypes.tracker = false;
        component.data.config.comboPieceTypes.mechanicHelper = false;
        component.data.config.comboPieceTypes.dungeon = false;
        component.data.config.comboPieceTypes.initiative = false;
        component.data.config.comboPieceTypes.ring = false;
        component.data.config.comboPieceTypes.realCard = true;
        component.data.config.decklist = 'Forest [ecl] 283';
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).not.toContain('Gilt-Leaf Alchemist');

        component.data.config.decklist = 'Gilt-Leaf Alchemist';
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).toContain('Forest [ecl] 283');
    }, 30000);

    test('Feature: Related conjure real cards are one-way from conjuring cards to conjured cards.', async () => {
        const component = wrapper.getCurrentComponent();

        component.data.config.comboPieceTypes.token = false;
        component.data.config.comboPieceTypes.emblem = false;
        component.data.config.comboPieceTypes.tracker = false;
        component.data.config.comboPieceTypes.mechanicHelper = false;
        component.data.config.comboPieceTypes.dungeon = false;
        component.data.config.comboPieceTypes.initiative = false;
        component.data.config.comboPieceTypes.ring = false;
        component.data.config.comboPieceTypes.realCard = true;
        component.data.config.decklist = 'Stab Wound [pio] 111';
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).not.toContain('Perforator Crocodile');

        component.data.config.decklist = 'Perforator Crocodile [ymkm] 11';
        await component.ctx.loadCardList();
        await component.ctx.generateRelatedComboPieces();

        expect(component.data.config.decklist).toContain('Stab Wound [pio] 111');
    }, 30000);
});

describe('shouldShowSetOption()', async () => {
    const options = {
        standard: { name: 'Standard (001)', isPromo: undefined, isDigital: undefined },
        promo: { name: 'Promo (001)', isPromo: true, isDigital: undefined },
        digital: { name: 'Digital (001)', isPromo: undefined, isDigital: true },
        digitalPromo: { name: 'Promo and Digital (001)', isPromo: true, isDigital: true },
    }
    const card = {
        quantity: 1,
        name: 'test',
        isBasic: undefined,
        setOptions: [
            options.standard,
            options.promo,
            options.digital,
            options.digitalPromo,
        ],
        selectedOption: options.standard,
    };

    test('No Promos, No Digital', async () => {
        wrapper.getCurrentComponent().data.config.activeWorkspaceTab = 'print';
        wrapper.getCurrentComponent().data.config.analysisMode = false;
        await wrapper.vm.$nextTick();

        wrapper.find('input[name="include-digital"]').setValue(false);
        wrapper.find('input[name="include-promo"]').setValue(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('No Promos, Yes Digital', async () => {
        wrapper.getCurrentComponent().data.config.activeWorkspaceTab = 'print';
        wrapper.getCurrentComponent().data.config.analysisMode = false;
        await wrapper.vm.$nextTick();

        wrapper.find('input[name="include-digital"]').setValue(true);
        wrapper.find('input[name="include-promo"]').setValue(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('Yes Promos, No Digital', async () => {
        wrapper.getCurrentComponent().data.config.activeWorkspaceTab = 'print';
        wrapper.getCurrentComponent().data.config.analysisMode = false;
        await wrapper.vm.$nextTick();

        wrapper.find('input[name="include-digital"]').setValue(false);
        wrapper.find('input[name="include-promo"]').setValue(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('Yes Promos, Yes Digital', async () => {
        wrapper.getCurrentComponent().data.config.activeWorkspaceTab = 'print';
        wrapper.getCurrentComponent().data.config.analysisMode = false;
        await wrapper.vm.$nextTick();

        wrapper.find('input[name="include-digital"]').setValue(true);
        wrapper.find('input[name="include-promo"]').setValue(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(true);
    });
});

describe('Print layout', async () => {
    test('All pages mode mirrors back rows', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.cards = [
            {
                quantity: 1,
                name: 'alpha',
                isBasic: false,
                selectedOption: { urlFront: 'a-front', urlBack: 'a-back' },
            },
            {
                quantity: 1,
                name: 'bravo',
                isBasic: false,
                selectedOption: { urlFront: 'b-front', urlBack: 'b-back' },
            },
            {
                quantity: 1,
                name: 'charlie',
                isBasic: false,
                selectedOption: { urlFront: 'c-front', urlBack: 'c-back' },
            },
        ];

        const pages = ctx.printPages;
        expect(pages.length).toBe(2);

        const frontSlots = pages[0].slots.slice(0, 3).map((slot) => slot.card.name);
        const backSlots = pages[1].slots.slice(0, 3).map((slot) => slot.card.name);

        expect(frontSlots).toEqual(['alpha', 'bravo', 'charlie']);
        // Back slots are in the same order; row-mirroring is handled via CSS direction: rtl
        expect(backSlots).toEqual(['alpha', 'bravo', 'charlie']);
    });

    test('All pages mode produces front and back page groups', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.cards = Array.from({ length: 10 }, (_, i) => {
            return {
                quantity: 1,
                name: `card-${i + 1}`,
                isBasic: false,
                selectedOption: { urlFront: `front-${i + 1}`, urlBack: `back-${i + 1}` },
            };
        });

        const pages = ctx.printPages;
        expect(pages.length).toBe(2);
        expect(pages[0].slots.length).toBe(10);
        expect(pages[1].slots.length).toBe(10);
        expect(pages[0].isBack).toBe(false);
        expect(pages[1].isBack).toBe(true);
    });

    test('All pages mode alternates front and back pages when fixed page size is used', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.config.fixedPageSize = true;
        data.cards = Array.from({ length: 10 }, (_, i) => {
            return {
                quantity: 1,
                name: `card-${i + 1}`,
                isBasic: false,
                selectedOption: { urlFront: `front-${i + 1}`, urlBack: `back-${i + 1}` },
            };
        });

        const pages = ctx.printPages;
        expect(pages.length).toBe(4);
        expect(pages[0].isBack).toBe(false);
        expect(pages[1].isBack).toBe(true);
        expect(pages[2].isBack).toBe(false);
        expect(pages[3].isBack).toBe(true);
    });

    test('All pages opposite mode leaves duplicate game piece backs empty', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.config.tokenBackMode = 'opposite';
        data.config.imageType = 'normal';
        data.config.fixedPageSize = false;
        data.config.cardsPerPage = null;
        const tokenCard = { quantity: 1, name: 'tiny', isBasic: false, selectedOption: { urlFront: 'token-front', urlBack: 'token-back', isToken: true, isGamePiece: true } };
        data.cards = [tokenCard];

        const pages = ctx.printPages;
        expect(pages.length).toBe(2);
        expect(pages[0].slots[0].card.name).toBe('tiny');
        expect(pages[1].slots[0]).toBe(null);
    });

    test('All pages opposite mode pairs different game pieces', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.config.tokenBackMode = 'opposite';
        data.config.fixedPageSize = true;
        data.config.cardsPerPage = null;
        data.cards = [
            {
                quantity: 4,
                name: 'treasure',
                isBasic: false,
                selectedOption: { setCode: 'tfin', collectorNumber: '1', urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
            {
                quantity: 1,
                name: 'pest',
                isBasic: false,
                selectedOption: { setCode: 'tsos', collectorNumber: '9', urlFront: 'pest-front', isToken: true, isGamePiece: true },
            },
            {
                quantity: 1,
                name: 'experience',
                isBasic: false,
                selectedOption: { setCode: 'tc15', collectorNumber: '0', urlFront: 'experience-front', isGamePiece: true },
            },
        ];

        const pages = ctx.printPages;
        const frontNames = pages[0].slots.filter(Boolean).map(slot => slot.card.name);
        const backNames = pages[1].slots.filter(Boolean).map(slot => slot.card.name);

        expect(frontNames).toEqual(['treasure', 'treasure', 'treasure', 'treasure']);
        expect(backNames).toEqual(['pest', 'experience']);
        expect(pages[1].slots.slice(2).every(slot => slot === null)).toBe(true);
        expect(ctx.printCapacity.missingCards).toBe(5);
        expect(ctx.printCapacity.missingGamePieces).toBe(12);
    });

    test('All pages game piece opposite mode uses paired front images on backs', async () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'all-pages';
        data.config.tokenBackMode = 'opposite';
        data.config.imageType = 'normal';
        data.config.fixedPageSize = false;
        data.config.cardsPerPage = null;
        data.config.decklist = 'Experience';
        await ctx.loadCardList();

        const experience = data.cards[0];

        expect(experience.selectedOption.isToken).toBe(undefined);
        expect(experience.selectedOption.isGamePiece).toBe(true);
        expect(ctx.resolveCardImage({ selectedOption: experience.selectedOption }, 'front')).toContain('73805b39-7624-4fbd-bcc0-4241e733a97f');
    });

    test('Single-sided printing reports one game piece face per empty physical card', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'none';
        data.config.fixedPageSize = true;
        data.config.cardsPerPage = null;
        data.cards = [
            {
                quantity: 6,
                name: 'treasure',
                isBasic: false,
                selectedOption: { urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
        ];

        expect(ctx.printCapacity.missingCards).toBe(3);
        expect(ctx.printCapacity.missingGamePieces).toBe(3);
    });

    test('Feature: Print content type filters can print only game pieces from a loaded deck.', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'none';
        data.config.includeCards = false;
        data.config.includeGamePieces = true;
        data.config.includeBasics = true;
        data.cards = [
            {
                quantity: 1,
                name: 'forest',
                isBasic: true,
                selectedOption: { urlFront: 'forest-front' },
            },
            {
                quantity: 1,
                name: 'lightning bolt',
                isBasic: false,
                selectedOption: { urlFront: 'bolt-front' },
            },
            {
                quantity: 2,
                name: 'treasure',
                isBasic: false,
                selectedOption: { urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
        ];

        expect(ctx.printSlotsFront.map(card => card.name)).toEqual(['treasure', 'treasure']);

        data.config.includeCards = true;
        data.config.includeBasics = false;
    });

    test('Feature: Print content type filters can print only regular cards from a loaded deck.', () => {
        const data = wrapper.getCurrentComponent().data;
        const ctx = wrapper.getCurrentComponent().ctx;

        data.config.cardBacks = 'none';
        data.config.includeCards = true;
        data.config.includeGamePieces = false;
        data.config.includeBasics = true;
        data.cards = [
            {
                quantity: 1,
                name: 'forest',
                isBasic: true,
                selectedOption: { urlFront: 'forest-front' },
            },
            {
                quantity: 1,
                name: 'lightning bolt',
                isBasic: false,
                selectedOption: { urlFront: 'bolt-front' },
            },
            {
                quantity: 2,
                name: 'treasure',
                isBasic: false,
                selectedOption: { urlFront: 'treasure-front', isToken: true, isGamePiece: true },
            },
        ];

        expect(ctx.printSlotsFront.map(card => card.name)).toEqual(['forest', 'lightning bolt']);

        data.config.includeGamePieces = true;
        data.config.includeBasics = false;
    });
});
