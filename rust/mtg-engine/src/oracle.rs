use regex::Regex;
use serde::{Deserialize, Serialize};

const CARD_TYPES: [&str; 6] = [
    "artifact",
    "battle",
    "creature",
    "enchantment",
    "land",
    "planeswalker",
];
const COLORS: [&str; 7] = [
    "white",
    "blue",
    "black",
    "red",
    "green",
    "colorless",
    "multicolored",
];
const STATE_QUALIFIERS: [&str; 4] = ["attacking", "blocking", "tapped", "untapped"];
const SUPERTYPES: [&str; 4] = ["basic", "legendary", "snow", "world"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleParseRequest {
    pub text: String,
    #[serde(default)]
    pub card_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OracleParseResult {
    pub actions: Vec<OracleAction>,
    pub errors: Vec<OracleDiagnostic>,
}

#[derive(Clone, Debug, Serialize)]
pub struct OracleAction {
    #[serde(rename = "type")]
    pub action_type: String,
    pub raw: String,
    pub amount: Amount,
    pub targets: Vec<TargetObject>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Amount {
    pub kind: String,
    pub raw: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<i32>,
}

#[derive(Clone, Debug, Serialize)]
pub struct TargetObject {
    pub selector: String,
    pub raw: String,
    pub candidates: Vec<EntityCandidate>,
    pub quantity: TargetQuantity,
}

#[derive(Clone, Debug, Default, Serialize)]
pub struct TargetQuantity {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<i32>,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityCandidate {
    pub entity: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub card_types: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub colors: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub excluded_card_types: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub qualifiers: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub subtypes: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub supertypes: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleDiagnostic {
    pub code: String,
    pub severity: String,
    pub message: String,
    pub clause: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

struct ParsedCandidate {
    candidate: EntityCandidate,
    supported: bool,
}

fn normalize_text(value: &str) -> String {
    value
        .replace('\r', "")
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn split_oracle_clauses(value: &str) -> Vec<String> {
    let normalized = value.replace(['\r', '•'], "\n");
    let clause_re = Regex::new(r"[^.;\n]+[.;]?").expect("clause regex compiles");
    clause_re
        .find_iter(&normalized)
        .map(|matched| normalize_text(matched.as_str()))
        .filter(|clause| !clause.is_empty())
        .collect()
}

fn clean_target_expression(value: &str) -> String {
    normalize_text(value)
        .trim_end_matches(',')
        .trim()
        .trim_end_matches(" instead")
        .trim_end_matches(" at random")
        .trim()
        .to_string()
}

fn split_each_targets(body: &str) -> Vec<String> {
    body.split(" and each ")
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn split_entity_alternatives(body: &str) -> Vec<String> {
    body.split(" or ")
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn permanent_candidate(card_types: Vec<String>) -> EntityCandidate {
    EntityCandidate {
        entity: "permanent".to_string(),
        card_types,
        ..EntityCandidate::default()
    }
}

fn any_target_candidates() -> Vec<EntityCandidate> {
    vec![
        EntityCandidate {
            entity: "player".to_string(),
            role: Some("any".to_string()),
            ..EntityCandidate::default()
        },
        permanent_candidate(vec!["creature".to_string()]),
        permanent_candidate(vec!["planeswalker".to_string()]),
        permanent_candidate(vec!["battle".to_string()]),
    ]
}

fn extract_qualifiers(raw_body: &str) -> (String, Vec<String>) {
    let mut body = raw_body.to_lowercase();
    let mut qualifiers = Vec::new();
    for phrase in ["with flying", "without flying"] {
        if body.contains(phrase) {
            qualifiers.push(phrase.to_string());
            body = body.replace(phrase, "");
        }
    }

    for qualifier in STATE_QUALIFIERS {
        let word_re = Regex::new(&format!(r"\b{}\b", regex::escape(qualifier)))
            .expect("state qualifier regex compiles");
        if word_re.is_match(&body) {
            qualifiers.push(qualifier.to_string());
            body = word_re.replace_all(&body, "").to_string();
        }
    }

    (normalize_text(&body), qualifiers)
}

fn parse_entity_candidate_detailed(raw_body: &str) -> ParsedCandidate {
    let (body, qualifiers) = extract_qualifiers(raw_body);
    if Regex::new(r"\bopponents?\b")
        .expect("opponent regex compiles")
        .is_match(&body)
    {
        return ParsedCandidate {
            candidate: EntityCandidate {
                entity: "player".to_string(),
                role: Some("opponent".to_string()),
                qualifiers,
                ..EntityCandidate::default()
            },
            supported: true,
        };
    }

    if Regex::new(r"\bplayers?\b")
        .expect("player regex compiles")
        .is_match(&body)
    {
        return ParsedCandidate {
            candidate: EntityCandidate {
                entity: "player".to_string(),
                role: Some("any".to_string()),
                qualifiers,
                ..EntityCandidate::default()
            },
            supported: true,
        };
    }

    let words = body.split_whitespace().collect::<Vec<_>>();
    let card_types = CARD_TYPES
        .iter()
        .filter(|card_type| words.contains(card_type))
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let supertypes = SUPERTYPES
        .iter()
        .filter(|supertype| words.contains(supertype))
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let colors = COLORS
        .iter()
        .filter(|color| words.contains(color))
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let mut excluded_card_types = Vec::new();
    if words.contains(&"nonland") {
        excluded_card_types.push("land".to_string());
    }

    let known_words = ["card", "cards", "nonland", "permanent", "spell", "target"];
    let subtypes = words
        .iter()
        .filter(|word| {
            !known_words.contains(word)
                && !CARD_TYPES.contains(word)
                && !SUPERTYPES.contains(word)
                && !COLORS.contains(word)
        })
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let supported = !card_types.is_empty()
        || !supertypes.is_empty()
        || !colors.is_empty()
        || !excluded_card_types.is_empty()
        || words.contains(&"permanent");

    ParsedCandidate {
        candidate: EntityCandidate {
            entity: "permanent".to_string(),
            card_types,
            colors,
            excluded_card_types,
            qualifiers,
            subtypes,
            supertypes,
            ..EntityCandidate::default()
        },
        supported,
    }
}

fn target_object(
    selector: &str,
    raw: &str,
    candidates: Vec<EntityCandidate>,
    quantity: TargetQuantity,
) -> TargetObject {
    TargetObject {
        selector: selector.to_string(),
        raw: raw.to_string(),
        candidates,
        quantity,
    }
}

fn diagnostic(
    code: &str,
    clause: &str,
    message: &str,
    request: &OracleParseRequest,
    details: Option<serde_json::Value>,
) -> OracleDiagnostic {
    OracleDiagnostic {
        code: code.to_string(),
        severity: "unsupported".to_string(),
        message: message.to_string(),
        clause: clause.to_string(),
        card_name: request.card_name.clone(),
        details,
    }
}

fn unsupported_target_diagnostic(
    raw: &str,
    clause: &str,
    request: &OracleParseRequest,
) -> OracleDiagnostic {
    diagnostic(
        "unsupported_damage_target",
        clause,
        "Damage target expression is not supported yet.",
        request,
        Some(serde_json::json!({ "target": raw })),
    )
}

fn parse_oracle_targets_detailed(
    value: &str,
    clause: &str,
    request: &OracleParseRequest,
) -> (Vec<TargetObject>, Vec<OracleDiagnostic>) {
    let raw = clean_target_expression(value);
    let mut errors = Vec::new();
    if raw.is_empty()
        || Regex::new(r"\b(damage|divided|among|choose)\b")
            .expect("unsupported target regex compiles")
            .is_match(&raw)
    {
        return (
            Vec::new(),
            vec![unsupported_target_diagnostic(&raw, clause, request)],
        );
    }

    if raw.eq_ignore_ascii_case("any target") {
        return (
            vec![target_object(
                "anyTarget",
                &raw,
                any_target_candidates(),
                TargetQuantity {
                    min: Some(1),
                    max: Some(1),
                },
            )],
            errors,
        );
    }

    if let Some(each_body) = raw.strip_prefix("each ") {
        let targets = split_each_targets(each_body)
            .into_iter()
            .map(|part| {
                let parsed = parse_entity_candidate_detailed(&part);
                if !parsed.supported {
                    errors.push(unsupported_target_diagnostic(&part, clause, request));
                }

                target_object(
                    "each",
                    &format!("each {}", part),
                    vec![parsed.candidate],
                    TargetQuantity::default(),
                )
            })
            .collect::<Vec<_>>();
        return if errors.is_empty() {
            (targets, errors)
        } else {
            (Vec::new(), errors)
        };
    }

    let target_re = Regex::new(r"(?i)^(up to one )?target (.+)$").expect("target regex compiles");
    if let Some(captures) = target_re.captures(&raw) {
        let quantity = if captures.get(1).is_some() {
            TargetQuantity {
                min: Some(0),
                max: Some(1),
            }
        } else {
            TargetQuantity {
                min: Some(1),
                max: Some(1),
            }
        };
        let candidates = split_entity_alternatives(&captures[2].to_lowercase())
            .into_iter()
            .map(|part| {
                let parsed = parse_entity_candidate_detailed(&part);
                if !parsed.supported {
                    errors.push(unsupported_target_diagnostic(&part, clause, request));
                }

                parsed.candidate
            })
            .collect::<Vec<_>>();
        return if errors.is_empty() {
            (
                vec![target_object("target", &raw, candidates, quantity)],
                errors,
            )
        } else {
            (Vec::new(), errors)
        };
    }

    let parsed = parse_entity_candidate_detailed(&raw);
    if !parsed.supported {
        errors.push(unsupported_target_diagnostic(&raw, clause, request));
    }

    if errors.is_empty() {
        (
            vec![target_object(
                "implicit",
                &raw,
                vec![parsed.candidate],
                TargetQuantity::default(),
            )],
            errors,
        )
    } else {
        (Vec::new(), errors)
    }
}

fn parse_amount(raw: &str) -> Amount {
    if raw.eq_ignore_ascii_case("x") {
        Amount {
            kind: "variable".to_string(),
            raw: raw.to_uppercase(),
            value: None,
        }
    } else {
        Amount {
            kind: "number".to_string(),
            raw: raw.to_string(),
            value: raw.parse::<i32>().ok(),
        }
    }
}

fn parse_damage_clause(
    clause: &str,
    request: &OracleParseRequest,
) -> (Vec<OracleAction>, Vec<OracleDiagnostic>, bool) {
    let damage_re =
        Regex::new(r"(?i)\bdeals? (X|\d+) damage to ([^.]+)").expect("damage regex compiles");
    let mut actions = Vec::new();
    let mut errors = Vec::new();
    let matches = damage_re.captures_iter(clause).collect::<Vec<_>>();
    for captures in &matches {
        let (targets, target_errors) = parse_oracle_targets_detailed(&captures[2], clause, request);
        errors.extend(target_errors);
        if targets.is_empty() {
            continue;
        }

        actions.push(OracleAction {
            action_type: "damage".to_string(),
            raw: captures[0].to_string(),
            amount: parse_amount(&captures[1]),
            targets,
        });
    }

    if !matches.is_empty() {
        return (actions, errors, true);
    }

    let loose_damage_re =
        Regex::new(r"(?i)\bdeals?\b[^.;]*\bdamage\b").expect("loose damage regex compiles");
    if loose_damage_re.is_match(clause) {
        let has_amount = Regex::new(r"(?i)\b(X|\d+) damage\b")
            .expect("damage amount regex compiles")
            .is_match(clause);
        let (code, message) = if has_amount {
            (
                "unsupported_damage_target",
                "Damage target expression is not supported yet.",
            )
        } else {
            (
                "unsupported_damage_amount",
                "Damage amount expression is not supported yet.",
            )
        };
        return (
            actions,
            vec![diagnostic(code, clause, message, request, None)],
            true,
        );
    }

    (actions, errors, false)
}

pub fn parse_oracle_document(request: OracleParseRequest) -> OracleParseResult {
    let mut actions = Vec::new();
    let mut errors = Vec::new();
    for clause in split_oracle_clauses(&request.text) {
        let (damage_actions, damage_errors, handled) = parse_damage_clause(&clause, &request);
        actions.extend(damage_actions);
        errors.extend(damage_errors);
        if !handled {
            errors.push(diagnostic(
                "unsupported_oracle_clause",
                &clause,
                "Oracle clause is not supported yet.",
                &request,
                None,
            ));
        }
    }

    OracleParseResult { actions, errors }
}
