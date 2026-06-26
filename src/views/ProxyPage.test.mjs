import { mount } from '@vue/test-utils';
import ProxyPage from './ProxyPage.vue';
import { describe, expect, test, beforeAll } from 'vitest';

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

    test('No Promos, No Digital', () => {
        wrapper.find('input[name="include-digital"]').setValue(false);
        wrapper.find('input[name="include-promo"]').setValue(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('No Promos, Yes Digital', () => {
        wrapper.find('input[name="include-digital"]').setValue(true);
        wrapper.find('input[name="include-promo"]').setValue(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('Yes Promos, No Digital', () => {
        wrapper.find('input[name="include-digital"]').setValue(false);
        wrapper.find('input[name="include-promo"]').setValue(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.standard)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digital)).toBe(false);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.promo)).toBe(true);
        expect(wrapper.getCurrentComponent().ctx.shouldShowSetOption(card, options.digitalPromo)).toBe(false);
    });

    test('Yes Promos, Yes Digital', () => {
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
