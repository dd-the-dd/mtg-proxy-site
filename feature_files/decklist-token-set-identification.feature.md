# Decklist Token Set Identification

## Purpose

- Token imports from wishlist-style decklists should resolve to the intended token family.
- Bracketed short codes such as `[tsos]` should be useful even when no collector number is present.

## User-visible behavior

- A token line with a bracketed set code selects a token printing from that set.
- A token line with both set code and collector number selects that exact token printing.
- Token lines with missing edition text can be completed from tokens associated with cards in the same imported session.
- Associated token completion preserves complete token edition text and manual session selections.
- Game pieces include tokens, reminders, trackers, mechanic helpers, dungeons, initiative, ring cards, and emblems for print back behavior.
- Game pieces are paired on opposite sides with different game pieces when possible; identical game pieces leave the opposite side empty instead of duplicating.
- The default game-piece back mode is opposite-side pairing rather than regular Magic backs.
- The print controls show open physical card slots and open game piece faces for the current page size.
- Print controls can include or exclude regular cards and game pieces independently after a decklist has been loaded.
- Loaded cards can be reordered before printing in an advanced print-order modal by selecting one print-slot preview and then another, so users can recover alignment or place specific cards on specific print slots without editing the deck text.
- The advanced print-order modal applies its draft order back to the parent print state only when confirmed, and the Print button uses that applied order.
- Game-piece opposite-side printing can use automatic token placement or the confirmed advanced print order; confirming advanced placement switches token placement to the chosen order.
- The advanced print-order modal previews the same front/back page structure as printing, including mirrored back pages, rather than showing only the raw source order.
- When local app mode is enabled by environment variable, a collapsible session menu stores named page states in local file-backed storage and restores them after reload.
- A collapsed combo-piece menu lets users choose which related pieces to auto-import: tokens, emblems, trackers, mechanic helpers, dungeons, initiative, ring cards, and real cards.
- The combo-piece generation button stays visible while the menu is collapsed, appends only missing related pieces, and reloads the imported images.
- Real-card combo piece links can be one-way when Scryfall lists both directions; a basic land linked from a source card should not import that source card back.
- Real-card combo links to cards with `conjure` in their oracle text are one-way; non-conjure cards do not import the cards that conjure them, while conjure cards can import the cards they create.
- Moxfield tags such as `#!ramp` are ignored after card edition text.
- Flavor names such as `Aang's Shelter` resolve to the original Scryfall card printing.
- If no matching token printing is found, import falls back to the existing default selection behavior.

## Key flows

- Importing `Pest [tsos]` selects a `Pest` token from `TSOS`.
- Importing `Pest [tsos] 9` selects `Pest` from `TSOS` collector number `9`.
- Importing `Pestbrood Sloth` and `Pest` selects the `Pest` token associated with `Pestbrood Sloth`.
- Importing `Pestbrood Sloth` and `Pest [tsos] 8` keeps `Pest` on collector number `8`.
- Printing `Experience` in token-opposite back mode uses its front image on the opposite side.
- Printing four `Treasure`, one `Pest`, and one `Experience` uses four physical cards, with two empty opposite-side faces.
- Printing can be narrowed to only game pieces from a loaded deck, or only regular cards from that same loaded deck.
- Clicking one print-slot preview in the advanced order modal highlights it; clicking a second preview swaps their print order while preserving their selected printings.
- Confirming an advanced order for opposite-side game-piece printing preserves that chosen order by pairing slots in sequence instead of recalculating automatic token pairs.
- In opposite-side game-piece mode, the advanced order preview and the printed pages show the same front page slots and back page slots.
- Local app sessions store the deck text, loaded cards, selected printings, print settings, errors, and chosen print order under a user-visible session name.
- Local app sessions persist deck text quantity edits by synchronizing loaded card quantities from the current deck text before saving.
- Local app sessions can be tagged as meta decks, and analysis mode renders loaded cards one per row with a matchup grid beside each card.
- The main workspace includes a Play setup screen that configures player count, each player's deck, human or AI roles, opponent hand visibility, play speed, and board zoom before the board is shown. Every player has a deck selector; the loaded deck is selected by default for player one when Play is opened from another workspace, but player one can still switch to another deck.
- Starting a Play game generates a deterministic opening simulation from a seed, switches to the full-width board, and shows image-based player zones for hand, battlefield, graveyard, and exile without rendering the action log panel by default.
- Simulation board state separates creatures, lands, and noncreature permanents inside one battlefield area, with lands on the left, creatures in the center, and noncreature permanents on the right; identical permanents that share the same state stack with a quantity badge, graveyard and exile stacks expand, and graveyard or exile cards that can be reused appear as virtual hand cards.
- Simulation board layout keeps the life totals, hand row, battlefield, and bottom phase controls compact enough for a two-player game to remain visible without an inner board scroll, while using the full available workspace width; hand cards and zone stacks can be smaller than battlefield permanents so the in-play cards remain readable.
- Simulation keeps lands in hand until a land play is chosen, exposes the normal one land play per turn as a tracked resource, and separates mana available now from mana available after using that land play.
- Simulation phase play starts on turn one with a seven-card hand, exposes a Next step control for upkeep, draw, main, attack, blockers, damage order, second main, and end, and renders the board from the selected phase snapshot.
- Simulation Next step advances to the next decision point by skipping phase snapshots where no player has an available action; blockers and damage ordering are skipped until attackers were declared, and discard is only surfaced when the active player exceeds their maximum hand size.
- Simulation phase snapshots mark cards with currently available actions in blue, but targeted cards are only actionable when at least one valid player or battlefield target exists; recoverable graveyard cards appear with a graveyard source marker, and recoverable exile cards appear with an exile source marker in the hand row.
- Double-clicking an action-ready simulation card plays or starts that card action; cards with several legal actions open an action picker, and targeted actions highlight valid card or player-life targets in orange until a target is selected.
- The game engine exposes a zone-aware player decision packet as JSON: options include source zone, source card, action kind, costs, named conditions, target requirements and candidates, plus a continue-step option. Human UI and AI decision logic consume this same packet instead of duplicating legality checks.
- A Rust engine backend exposes the Oracle parser and game decision packet as JSON contracts so analysis workers and future AI players can reuse the same high-performance rule engine instead of recomputing parser and legality logic in the Vue UI.
- Simulation players show life totals centered on their board edge, and player-targeting actions resolve by clicking the target player's life total.
- Simulation mana abilities parse basic lands and simple "Add {mana}" oracle text, tapping a mana source adds mana to the active player's mana pool, cast actions pay costs by tapping sufficient sources automatically when the payment is unique, and ambiguous payments are presented as choices instead of selecting lands arbitrarily.
- Simulation mana pools are visible in phase state, can be spent by later actions in the same step, and mana generated by a resolved mana action expires when advancing to a later step.
- Simulation library and hand counts reflect the current zone state: a 60-card deck starts near 53 cards in library after the opening hand, draw steps move one card from library to hand, and reannotating action-ready cards must not reset library counts to zero.
- Simulation libraries contain only real deck cards; tokens and other game pieces are excluded from shuffle/opening-hand construction and can only appear later through card effects.
- Play setup can enable or disable mulligans and choose how many opening mulligans are free; mulligans are enabled by default with zero free mulligans. When enabled, starting a game asks each human player to keep or mulligan before the first normal game step. Each mulligan still draws seven cards; when a player keeps after non-free mulligans, that player chooses which counted-mulligan cards to put on the bottom of their library using card images with a blue selected outline before the game starts on the first interactive step.
- Simulation logs are recorded in runtime/history data for resolved player and AI actions, including the step, player, action label, source card, and target when present, but the Play board does not display a log panel by default.
- Resolving a draw action moves the top remaining card of that player's library into their hand and updates hand and library counts.
- Lands with an enter-the-battlefield choice such as paying 2 life or entering tapped expose those choices before a human resolves the land play; paying life updates that player life total, and choosing tapped puts the land onto the battlefield tapped.
- AI-controlled players auto-resolve decision steps: they always play a land when one is available, then choose among supported legal actions until they stop or run out of actions.
- Tapped simulation permanents are represented by rotating the card 90 degrees while keeping count and state markers readable.
- Simulation board layout shows empty graveyard and exile placeholders without using a Magic card back, places two-player games face-to-face with the opponent hand/zones/battlefield above the current player's battlefield/hand/zones, places the phase/next-step bar at the bottom of that play surface, compacts two-player games so the defined zones fit in the main viewport, and places additional player pairs in horizontally scrollable lanes.
- Simulation board zones rely on card position, card images, and count badges instead of visible zone-title text, while keeping accessible zone labels for screen readers.
- Simulation player settings include deck selectors for every player, with an explicit loaded-deck option plus tagged meta sessions. The Play setup does not expose a separate matchup field or a turn-count field, and unset players do not inherit a hidden matchup fallback.
- Local app sessions persist saved simulation history entries alongside the deck, print, and analysis state.
- Analysis mode can show current-card interaction categories against all tagged meta decks or one selected matchup, with columns grouped by meta deck or by meta-creature mana value.
- Analysis mode can switch between interaction grid view and a visual value view that shows cast options, mana symbols, base value, synergy bonuses, permanent-provided options, and zone-change opportunities, each with distinct visual treatment.
- Visual value rows are structured as condition, cost, effect, and value columns; costs use Mana symbol glyphs, instant or flash-speed costs show a small speed marker, zero card-state changes are hidden, permanent-provided rows use the enabling card name as the condition, and the value column names the value category such as card quality improvement or creature improvement.
- Permanent-provided value rows use the speed of the enabling permanent or class source, not the speed of the spell being cast to feed the synergy.
- Zone movement value rows, such as class level 2 graveyard-to-hand recursion, render as a separate zone-action group instead of as permanent-provided cast improvement rows.
- Analysis cells can show card counts or deck percentages, and sideboard cards use a `+` indicator in cells where they add interaction coverage.
- Mana-value analysis columns are fixed from `0 mana` through `8 mana` and `9+ mana`; each cell sums matching meta cards in that column rather than echoing the evaluated card quantity.
- Analysis percentage cells divide matching meta-card count by the selected meta deck card count, not by the current column total.
- Meta removal analysis separates kill actions from nonlethal damage actions, and targeted removal or damage is blocked when the target creature has a simple targeting shield such as hexproof, shroud, or color protection from the source spell.
- Meta removal cells list the matched target cards in their detail text, include the removal color, mana trade, card trade, and simple instant-speed responses available in the meta deck. Meta-deck headers show kill and interaction coverage percentages for the currently analyzed card and can be collapsed per deck.
- Value analysis for cast options that can target opposing permanents shows per-meta-deck battlefield removal coverage under that specific option, including removed and damage percentages over the full meta-deck card quantity plus collapsible target details and protection responses.
- Removal protection responses include target-side instant or sorcery cast triggers that raise toughness enough to survive the damage, such as Colorstorm Stallion protecting itself when another instant is cast.
- Creature combat analysis accounts for flying/reach blocking restrictions, first strike, double strike, deathtouch, and simple unblockable text before classifying whether the attacker survives, defender survives, both die, both survive, or damage reaches the player.
- Permanents with activated abilities that turn them into creatures, such as Great Hall of the Biblioplex, are analyzed with their converted power, toughness, creature text, and printed combat synergies.
- Cards that create creature tokens expose token creation as value, but do not inherit the generated token's combat stats or combat synergies; generated tokens carry their own combat and synergy characteristics when analyzed as separate game pieces.
- Analysis separates synergy source rows from synergy feeder rows. Combat, graveyard-play, and creature-token synergies are shown separately, include trigger-card mana costs in cell details, and empty rows are hidden per analyzed card.
- Combat synergy parsing uses source-card pump text, so Izzet cards such as Slickshot Show-Off show `+2/+0` while prowess-style cards show `+1/+1`.
- Combat synergies provided by Class cards keep sorcery-speed detail labels even when the feeder spell is an instant.
- Value analysis can render alternate cast options such as kicker and plot; kicker options can unlock mana-spent threshold synergies such as Colorstorm Stallion's copy-token trigger.
- Card selection effects with word-number text, such as looking at the top two or three cards, count as card quality improvement.
- Value analysis renders activated ability rows for permanents and lands, including tap mana abilities, creature-conversion abilities, counter-spend token creation, and other board-action abilities.
- Stored local-session cards are hydrated from the minimized dataset on restore so older saved sessions regain analysis fields such as mana cost, mana value, characteristics, related tokens, and related game pieces without losing their selected printing.
- Passive ETB lifegain sources, such as creatures that gain life whenever another creature enters, create value rows on creature and creature-token-generating feeders.
- Passive creature-death payoff sources, such as Blood Artist, Arnyn, Pitiless Plunderer, or Sek'Kuar, create value rows only on creature feeders that satisfy their death-trigger conditions, classify drain, Treasure, creature-token, damage, draw, or generic death payoff value, and name generated tokens in the row detail.
- Class-card synergy costs are cumulative: level 2 includes the initial class cost plus the level 2 cost, and level 3 includes the initial class cost plus each prior level cost.
- Mana-value synergy columns use the synergy action cost rather than the synergy card's own mana value.
- Bounce spells that return target permanents to hand create a battlefield-to-hand synergy with permanents, and permanents with enters-the-battlefield text get an additional ETB recast synergy.
- Synergy action rows use action labels instead of generic feed labels.
- Loading indicators are scoped to the area that is actually waiting; the session menu, deck text, card shells, images, and analysis stats can load independently.
- Loading UI uses compact circular spinners or image skeletons, not rotating text labels.
- Deck imports publish card shells from the parsed text before the Scryfall dataset finishes loading, then hydrate each card's printing data independently.
- Analysis card rows show a small loading indicator beside each card name while that specific card is hydrating or waiting for queued analysis.
- Hovering a visible card image briefly opens a large image-only card preview fixed near the center-left of the screen so the card text can be read without covering the board, and leaving the card hides or cancels the preview.
- Analysis grids and value rows are prepared through a per-card queue and cache so template rendering reads prepared rows instead of recomputing every cell repeatedly.
- Value rows nested under a cast option display the full mana cost of that cast option, including colored symbols, while independent zone or activated actions keep their own action cost.
- Value analysis uses the current deck's cards for internal synergies and mana sources; meta decks only feed the against-meta interaction grid.
- Value analysis shows land mana abilities that can pay a cast option, keeps ETB passives under the cast in their own row color, and shows death triggers in a separate death-trigger section rather than as cast value.
- Value analysis shows mana sources as compact color-coded chips at the bottom of the card analysis, where payment sources use a distinct payment color, and additional-value rows show the full setup mana cost of the source that provides the value.
- Value analysis includes colorless sources that can pay generic or colorless costs, keeps land mana sources condensed as land-colored chips, and renders artifacts or mana-burst spells that can pay a cast option as normal payment rows inside the `Mana sources` section.
- Mana source symbols distinguish alternatives from combined mana: `Add {U} or {R}` renders with a slash between choices, while `Add {R}{R}` renders adjacent symbols without a slash.
- Permanent mana sources such as artifacts can appear in value analysis, and restricted mana such as `Spend this mana only to cast instant and sorcery spells` appears only on matching cast options while preserving all produced mana symbols.
- Value analysis parses 4c control spell patterns into concrete cast options, including modal choices, tiered additional costs, spree single and combined choices, conditional counters, battlefield removal, drain, card selection with X, and split prepared spell faces.
- Value analysis parses Sek'Kuar-style removal patterns into concrete cast options, including sacrifice-or-pay additional costs, sacrifice kicker costs, exile target creature or planeswalker, and target creature toughness-reduction removal.
- Oracle parsing classifies damage clauses into typed action records with numeric or variable amounts, target selectors, and target entity candidates such as player, creature, planeswalker, battle, artifact creature, and qualifier-constrained creatures.
- Oracle parsing can audit unsupported clauses and target expressions as structured errors with stable codes, source clauses, and optional card names; strict mode raises `OracleParseError` while normal analysis can keep using parsed actions permissively.
- Value analysis maps same-deck spell impacts onto permanents that care about those spells, including creature-land combat pumps that require a conversion setup cost and activated abilities unlocked by casting an instant or sorcery.
- Activated land and permanent abilities expose non-mana value such as impulse draw, stack protection, Treasure generation, and the condition required to activate them.
- Basic bounce effects such as `Return target permanent to its owner's hand` show two value uses: target an opponent permanent for battlefield-to-hand tempo, or target one of your non-land permanents for battlefield-to-hand plus draw.
- Modal instant creature-shape spells that make target creatures `1/1` with hexproof or `3/4` with flying and vigilance appear as creature modifier options for every creature in the current deck.
- The left session/config rail can collapse toward the left; when open it uses a narrow sidebar layout so analysis content keeps most of the page width.
- The workspace is organized around resources: Deck, Print, Analysis, Play, Card Analysis, Compare, and Meta, with top navigation switching between those contexts.
- The left rail keeps persistent session controls but shows only the configuration relevant to the active resource; deck import controls live in Deck, print layout controls live in Print, and analysis controls live in Analysis.
- Play opens on a game setup screen first, including when restoring the older persisted `simulation` tab name; the "game started" flag is not persisted in local sessions. Starting a game switches to the full-screen board, hides the global header, global resource navigation, setup controls, pre-game logs, and approval quote, and leaves only a compact options menu on the board.
- Card Analysis organizes parser output into effect registries such as enters-the-battlefield triggers, life-gain triggers, attack triggers, phase or step triggers, permanent modifiers, player modifiers, and rule parameter changes. Game simulation can consume these registries at the relevant event or phase instead of hard-coding every card interaction directly into the board UI.
- Rule-effect registries must distinguish temporary and permanent modifications to permanents, players, and rule parameters such as lands playable per turn, maximum hand size, draw-loss replacement, and game-loss conditions.
- The game engine exposes named events for cast, enter or leave battlefield, enter or leave graveyard, draw, mill, scry, surveil, discard, gain life, lose life, and beginning-of-step events for upkeep, draw, first main, combat, blockers, damage order, second main, and end step.
- Card-trigger hooks are represented as serializable rules with a source card, source controller, event name, named condition plus parameters, and named action plus parameters, so game simulation can evaluate triggers without hard-coding each card in the board UI.
- Spells and triggered abilities create stack entries in the game engine; lands are represented as special actions that can enter the battlefield and fire enter-battlefield hooks without creating a spell stack entry.
- Analysis card rows prioritize a near-card-sized image beside a compact interaction grid that avoids horizontal scrolling for normal meta views.
- Generating combo pieces for `Pestbrood Sloth` appends `Pest [tsos] 9` if no `Pest` line is already present.
- Generating combo pieces skips disabled categories and does not duplicate related pieces already in the decklist.
- Generating real-card combo pieces for `Gilt-Leaf Alchemist` appends `Forest [ecl] 283`, but generating from `Forest [ecl] 283` does not append `Gilt-Leaf Alchemist`.
- Generating real-card combo pieces for `Perforator Crocodile [ymkm] 11` appends `Stab Wound [pio] 111`, but generating from `Stab Wound [pio] 111` does not append `Perforator Crocodile`.
- Importing `Aang's Shelter` selects `Teferi's Protection` from `TLE` collector number `7`.
- Importing a token without set information keeps using the existing default.

## Constraints

- Set codes are parsed from short bracketed values.
- Collector numbers remain the exact-print discriminator when present.
- Set-only token imports may still have multiple art variants within a set; the first matching dataset option is selected.

## Test anchors

- Feature: Bracketed set code selects token printing.
- Feature: Bracketed set code and collector number select exact token printing.
- Feature: Associated session cards complete missing token edition text.
- Feature: Flavor name imports resolve to original card printings.
- Feature: Related combo piece generation appends missing selected piece types.
