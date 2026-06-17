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
