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
}, 30000);

describe('Core Rendering', async () => {
    test('Renders', () => {
        expect(wrapper.find('#deck-input').exists()).toBe(true);
    });

    test('Feature: Game piece opposite-side pairing is the default token back mode.', () => {
        expect(wrapper.getCurrentComponent().data.config.tokenBackMode).toBe('opposite');
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
    });
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
});
