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
- The print controls show open physical card slots and open game piece faces for the current page size.
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
