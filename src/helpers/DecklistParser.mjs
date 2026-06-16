import { normalizeCardName } from "./CardNames.mjs";

export function parseDecklist(decklist) {
    const response = {
        lines: [],
        errors: [],
    };

    for (let line of decklist.split("\n")) {
        line = line.trim();

        // Different sites have different sideboard formats.
        // Look for the word "sideboard" or lines that start with a double slash and skip them.
        // CubeCobra uses # to represent a comment line.
        // MTGA uses Sideboard and Deck as section headers.
        if (
            /^Sideboard:?$/i.test(line) ||
            /^Deck:?$/i.test(line) ||
            /^\/\//.test(line) ||
            /^#/.test(line) ||
            line === ""
        ) {
            continue;
        }

        line = line.replace(/\s+#!\S+/g, "").trim();

        // Extract the quantity and card name.
        // Cockatrice prefixes lines with "SB:" for sideboard cards, so optionally matching that.
        // Last I knew MTGA's export format puts the set and collector number in the line. ex. Arid Mesa (ZEN) 211
        const extract =
            /^(?:SB:\s+)?(?:(\d+)\s*x?\s)?(.+?)\s*(?:\(([^()]*)\)\s+([-\w★]+)|\[([^\]]+)\](?:\s+([-\w★]+))?)?$/i.exec(
                line,
            );

        if (extract === null) {
            response.errors.push(line);
            console.warn(`Failed to parse line: ${line}`);
            continue;
        }

        let [
            ,
            quantity,
            inputCardName,
            parenSet = undefined,
            collectorsNumberFromParen = undefined,
            bracketSet = undefined,
            collectorsNumberFromBracket = undefined,
        ] = extract;

        const setName = parenSet || bracketSet;
        const collectorsNumber = collectorsNumberFromParen || collectorsNumberFromBracket;

        if (quantity === undefined) {
            quantity = 1;
        }

        // parseInt should be safe here since it's a digit extraction,
        // decimal numbers will just get roped into the cardName and fail.
        if (parseInt(quantity) <= 0) {
            continue;
        }

        response.lines.push({
            name: normalizeCardName(inputCardName),
            quantity: parseInt(quantity),
            ...(setName ? { set: setName.toLocaleLowerCase() } : {}),
            ...(collectorsNumber ? { collectorsNumber } : {}),
        });
    }

    return response;
}
