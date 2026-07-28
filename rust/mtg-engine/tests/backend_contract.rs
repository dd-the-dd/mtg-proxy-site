use mtg_engine::game::{DecisionRequest, build_player_decision_options};
use mtg_engine::http::route_json;
use mtg_engine::oracle::{OracleParseRequest, parse_oracle_document};
use serde_json::{Value, json};

/// Feature: Rust Oracle backend returns JS-compatible damage actions and diagnostics.
#[test]
fn oracle_backend_returns_damage_actions_and_diagnostics() {
    let result = parse_oracle_document(OracleParseRequest {
        card_name: Some("Parser Fixture".to_string()),
        text: [
            "Abrade deals 3 damage to target creature.",
            "Tap target creature.",
        ]
        .join("\n"),
    });
    let value = serde_json::to_value(result).expect("oracle result serializes");

    assert_eq!(value["actions"][0]["type"], "damage");
    assert_eq!(value["actions"][0]["amount"]["value"], 3);
    assert_eq!(value["actions"][0]["targets"][0]["selector"], "target");
    assert_eq!(
        value["actions"][0]["targets"][0]["candidates"][0]["entity"],
        "permanent"
    );
    assert_eq!(
        value["actions"][0]["targets"][0]["candidates"][0]["cardTypes"],
        json!(["creature"])
    );
    assert_eq!(value["errors"][0]["code"], "unsupported_oracle_clause");
    assert_eq!(value["errors"][0]["cardName"], "Parser Fixture");
}

/// Feature: Rust game backend exposes zone-aware decision packets for players.
#[test]
fn game_backend_lists_zone_aware_decision_options() {
    let request: DecisionRequest = serde_json::from_value(json!({
        "phase": "main",
        "player": {
            "key": "you",
            "name": "You",
            "role": "human",
            "zones": {
                "battlefield": {
                    "creatures": [],
                    "lands": [{
                        "id": "mountain:0",
                        "name": "mountain",
                        "state": { "tapped": false },
                        "typeLine": "Basic Land - Mountain"
                    }],
                    "nonCreaturePermanents": [{
                        "id": "tablet:0",
                        "manaCost": "{1}",
                        "name": "tablet",
                        "oracleText": "{T}: Add {R}.\n{T}: Draw a card.",
                        "state": { "tapped": false },
                        "typeLine": "Artifact"
                    }]
                },
                "exile": { "cards": [], "recoverable": [] },
                "graveyard": {
                    "cards": [{
                        "id": "grave spark:0",
                        "manaCost": "{R}",
                        "name": "grave spark",
                        "oracleText": "Grave Spark deals 1 damage to any target. You may cast this card from your graveyard.",
                        "typeLine": "Instant"
                    }],
                    "recoverable": []
                },
                "hand": [{
                    "id": "mountain:hand",
                    "name": "mountain",
                    "typeLine": "Basic Land - Mountain"
                }, {
                    "id": "flame slash:0",
                    "manaCost": "{R}",
                    "name": "flame slash",
                    "oracleText": "Flame Slash deals 4 damage to target creature.",
                    "typeLine": "Sorcery"
                }],
                "landPlaysAvailable": 1,
                "manaPool": {},
                "playableHand": []
            }
        },
        "targetPlayers": [{
            "key": "opponent",
            "name": "Opponent",
            "role": "ai",
            "zones": {
                "battlefield": {
                    "creatures": [{
                        "id": "bear:0",
                        "name": "bear",
                        "state": { "tapped": false },
                        "typeLine": "Creature - Bear"
                    }],
                    "lands": [],
                    "nonCreaturePermanents": []
                },
                "exile": { "cards": [], "recoverable": [] },
                "graveyard": { "cards": [], "recoverable": [] },
                "hand": [],
                "landPlaysAvailable": 0,
                "manaPool": {},
                "playableHand": []
            }
        }]
    })).expect("decision request parses");

    let packet = build_player_decision_options(request);
    let value = serde_json::to_value(packet).expect("decision packet serializes");
    let options = value["options"].as_array().expect("options is an array");

    assert!(
        options
            .iter()
            .any(|option| option["kind"] == "advanceStep" && option["sourceZone"] == "game")
    );
    assert!(options.iter().any(|option| {
        option["kind"] == "playLand"
            && option["sourceZone"] == "hand"
            && option["conditions"]
                .as_array()
                .unwrap()
                .iter()
                .any(|condition| {
                    condition["name"] == "landPlayAvailable"
                        && condition["params"]["remaining"] == 1
                })
    }));
    assert!(options.iter().any(|option| {
        option["kind"] == "cast"
            && option["card"]["name"] == "flame slash"
            && option["targets"]["required"] == true
            && option["targets"]["candidates"]["cards"][0]["card"]["name"] == "bear"
    }));
    assert!(
        options
            .iter()
            .any(|option| option["kind"] == "cast" && option["sourceZone"] == "graveyard")
    );
    assert!(
        options
            .iter()
            .any(|option| option["kind"] == "mana" && option["card"]["name"] == "tablet")
    );
    assert!(
        options
            .iter()
            .any(|option| option["kind"] == "activate" && option["card"]["name"] == "tablet")
    );
}

/// Feature: Rust engine backend routes JSON requests for Oracle analysis.
#[test]
fn backend_routes_oracle_parse_json() {
    let response = route_json(
        "POST",
        "/oracle/parse",
        &json!({
            "cardName": "HTTP Fixture",
            "text": "Burst Lightning deals 2 damage to any target."
        })
        .to_string(),
    );
    let body: Value = serde_json::from_str(&response.body).expect("response body parses");

    assert_eq!(response.status, 200);
    assert_eq!(body["actions"][0]["type"], "damage");
    assert_eq!(body["actions"][0]["targets"][0]["selector"], "anyTarget");

    let preflight = route_json("OPTIONS", "/oracle/parse", "");
    assert_eq!(preflight.status, 200);
}
