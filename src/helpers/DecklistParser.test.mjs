import { describe, expect, test } from "vitest";
import { parseDecklist } from "./DecklistParser.mjs";
const ScryfallDatasetAsync = () => import("../../data/cards-minimized.json");

describe("parseDecklist()", () => {
    describe("Quantities", () => {
        test("Unspecified", () => {
            expect(
                parseDecklist(
                    `
                    Ghor-Clan Rampager
                    `,
                ),
            ).toStrictEqual({
                lines: [{ name: "ghor-clan rampager", quantity: 1 }],
                errors: [],
            });
        });

        test("N abc", () => {
            expect(
                parseDecklist(
                    `
                    3 Ghor-Clan Rampager
                    `,
                ),
            ).toStrictEqual({
                lines: [{ name: "ghor-clan rampager", quantity: 3 }],
                errors: [],
            });
        });

        test("Nx abc", () => {
            expect(
                parseDecklist(
                    `
                    4x Ghor-Clan Rampager
                    `,
                ),
            ).toStrictEqual({
                lines: [{ name: "ghor-clan rampager", quantity: 4 }],
                errors: [],
            });
        });

        test("Double Digit", () => {
            expect(
                parseDecklist(
                    `
                    43 Ghor-Clan Rampager
                    `,
                ),
            ).toStrictEqual({
                lines: [{ name: "ghor-clan rampager", quantity: 43 }],
                errors: [],
            });
        });

        test("Zero", () => {
            expect(
                parseDecklist(
                    `
                    0 Ghor-Clan Rampager
                    `,
                ),
            ).toStrictEqual({
                lines: [],
                errors: [],
            });
        });

        test("Mixed", () => {
            expect(
                parseDecklist(
                    `
                    4 Kird Ape
                    39x Fireblast
                    1 +2 Mace
                    Ghor-Clan Rampager
                    0 Griselbrand
                    9 9 9 9 9
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "kird ape", quantity: 4 },
                    { name: "fireblast", quantity: 39 },
                    { name: "+2 mace", quantity: 1 },
                    { name: "ghor-clan rampager", quantity: 1 },
                    { name: "9 9 9 9", quantity: 9 },
                ],
                errors: [],
            });
        });

        test("Moxfield tags are ignored after card edition text", () => {
            expect(
                parseDecklist(
                    `
                        arcane signet (tdc) 105 #!mana_dork #!mana_p
                        blood artist (soc) 209 #!d_c #!life_p #!ping_p
                        farseek (fic) 302 #!ramp
                        mayhem devil (plst) war-204 #!ping_p #!sacrifice_c
                        open the omenpaths (khm) 143 #!mana_p
                        smothering abomination (soc) 226 #!card_advantage #!sacrifice_c #!sacrifice_p
                        vengeful bloodwitch (fdn) 76 #!d_c #!life_p #!ping_p
                    `,
                ),
            ).toStrictEqual({
                errors: [],
                lines: [
                    { name: "arcane signet", quantity: 1, set: "tdc", collectorsNumber: "105" },
                    { name: "blood artist", quantity: 1, set: "soc", collectorsNumber: "209" },
                    { name: "farseek", quantity: 1, set: "fic", collectorsNumber: "302" },
                    { name: "mayhem devil", quantity: 1, set: "plst", collectorsNumber: "war-204" },
                    { name: "open the omenpaths", quantity: 1, set: "khm", collectorsNumber: "143" },
                    { name: "smothering abomination", quantity: 1, set: "soc", collectorsNumber: "226" },
                    { name: "vengeful bloodwitch", quantity: 1, set: "fdn", collectorsNumber: "76" },
                ],
            });
        });
    });

    describe("Ignored Lines", () => {
        test("Empty Lines", () => {
            expect(
                parseDecklist(
                    `

                    `,
                ),
            ).toStrictEqual({
                lines: [],
                errors: [],
            });
        });

        test("Deck Section Header", () => {
            expect(
                parseDecklist(
                    `
                    Deck
                    Deck:
                    1x Abandon Hope
                    The Deck of Many Things
                    Deck Deck Go (ABC) 123
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "abandon hope", quantity: 1 },
                    { name: "the deck of many things", quantity: 1 },
                    {
                        name: "deck deck go",
                        collectorsNumber: "123",
                        quantity: 1,
                        set: "abc",
                    },
                ],
                errors: [],
            });
        });

        test("Sideboard Section Header", () => {
            expect(
                parseDecklist(
                    `
                    sideboard
                    Sideboard
                    Sideboard:
                    3x Abandon Hope
                    SB:   2x Price of Progress
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "abandon hope", quantity: 3 },
                    { name: "price of progress", quantity: 2 },
                ],
                errors: [],
            });
        });

        test("Commented Out Lines", () => {
            expect(
                parseDecklist(
                    `
                    // Comment
                    2x Abandon Hope
                    // Another comment
                    fire // ice
                    # comment
                    #comment
                    ## Comment
                    Experiment #9
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "abandon hope", quantity: 2 },
                    { name: "fire // ice", quantity: 1 },
                    { name: "experiment #9", quantity: 1 },
                ],
                errors: [],
            });
        });
    });

    describe("Deck Formats", () => {
        // FIXME: Moxfield exports with MTAG with an "About" header, don't know if it's worth supporting that or not.
        test("MTGA/Moxfield Format", () => {
            expect(
                parseDecklist(
                    `
                    Deck
                    4 Abandon Hope (TMP) 107
                    2 Hazmat Suit (USED)
                    Erase (Not the Urza‛s Legacy One) (UNH) 10
                    2x Vadmir, New Blood (POTJ) 113p

                    SIDEBOARD:
                    // Scryfall excludes the Set in some cases?
                    2 Brotherhood's End () 128
                    2 Final Revels (LRW) 113
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    {
                        name: "abandon hope",
                        quantity: 4,
                        set: "tmp",
                        collectorsNumber: "107",
                    },
                    { name: "hazmat suit (used)", quantity: 2 },
                    {
                        name: `erase (not the urza's legacy one)`,
                        quantity: 1,
                        set: "unh",
                        collectorsNumber: "10",
                    },
                    {
                        name: "vadmir, new blood",
                        quantity: 2,
                        set: "potj",
                        collectorsNumber: "113p",
                    },
                    {
                        name: `brotherhood's end`,
                        quantity: 2,
                        collectorsNumber: "128",
                    },
                    {
                        name: "final revels",
                        quantity: 2,
                        set: "lrw",
                        collectorsNumber: "113",
                    },
                ],
                errors: [],
            });
        });

        test("Scryfall Clipboard Format", () => {
            expect(
                parseDecklist(
                    `
                    5 Mountain
                    4 City of Traitors

                    // Sideboard
                    2 Brotherhood's End
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "mountain", quantity: 5 },
                    { name: "city of traitors", quantity: 4 },
                    { name: `brotherhood's end`, quantity: 2 },
                ],
                errors: [],
            });
        });

        test("Basic Format", () => {
            expect(
                parseDecklist(
                    `
                    4 Abandon Hope
                    2 Hazmat Suit (USED)
                    1 Erase (Not the Urza‛s Legacy One)
                    1 Dark Ritual (STA) 26

                    Sideboard
                    2 Vadmir, New Blood
                    `,
                ),
            ).toStrictEqual({
                lines: [
                    { name: "abandon hope", quantity: 4 },
                    { name: "hazmat suit (used)", quantity: 2 },
                    { name: `erase (not the urza's legacy one)`, quantity: 1 },
                    {
                        name: "dark ritual",
                        quantity: 1,
                        set: "sta",
                        collectorsNumber: "26",
                    },
                    { name: "vadmir, new blood", quantity: 2 },
                ],
                errors: [],
            });
        });

        test("edge cases with ★ and - and //", () => {
            expect(
                parseDecklist(
                    `
                        1 Filigree Familiar (plst) GNT-52
                        1 Geth's Grimoire (plst) DST-123
                        1 Grim Discovery (plst) DDR-51
                        1 Hostile Hostel // Creeping Inn (prm) 94088
                        1 Solemn Simulacrum (sld) 791★
                    `,
                ),
            ).toStrictEqual({
                errors: [],
                lines: [
                    {
                        collectorsNumber: "GNT-52",
                        name: "filigree familiar",
                        quantity: 1,
                        set: "plst",
                    },
                    {
                        collectorsNumber: "DST-123",
                        name: "geth's grimoire",
                        quantity: 1,
                        set: "plst",
                    },
                    {
                        collectorsNumber: "DDR-51",
                        name: "grim discovery",
                        quantity: 1,
                        set: "plst",
                    },
                    {
                        collectorsNumber: "94088",
                        name: "hostile hostel // creeping inn",
                        quantity: 1,
                        set: "prm",
                    },
                    {
                        collectorsNumber: "791★",
                        name: "solemn simulacrum",
                        quantity: 1,
                        set: "sld",
                    },
                ],
            });
        });
    });

    describe("Bracketed set codes and quantity variants", () => {
        test("Various bracket and quantity forms", () => {
            const input = `
                1x Graveborn [tcmm]
                1x Graveborn
                1 Graveborn [tcmm]
                Graveborn [tcmm]
                23 Graveborn
                Graveborn
            `;

            expect(parseDecklist(input)).toStrictEqual({
                lines: [
                    { name: "graveborn", quantity: 1, set: "tcmm" },
                    { name: "graveborn", quantity: 1 },
                    { name: "graveborn", quantity: 1, set: "tcmm" },
                    { name: "graveborn", quantity: 1, set: "tcmm" },
                    { name: "graveborn", quantity: 23 },
                    { name: "graveborn", quantity: 1 },
                ],
                errors: [],
            });
        });

        test("Bracket codes are treated as set codes", () => {
            const input = `
                1 Card Name [zen]
                1 Card Name [mma]
                1 Pest [tsos]
                1 Pest [tsos] 9
            `;

            expect(parseDecklist(input)).toStrictEqual({
                lines: [
                    { name: "card name", quantity: 1, set: "zen" },
                    { name: "card name", quantity: 1, set: "mma" },
                    { name: "pest", quantity: 1, set: "tsos" },
                    { name: "pest", quantity: 1, set: "tsos", collectorsNumber: "9" },
                ],
                errors: [],
            });
        });
    });
});
