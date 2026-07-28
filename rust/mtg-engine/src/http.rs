use crate::game::{DecisionRequest, build_player_decision_options};
use crate::oracle::{OracleParseRequest, parse_oracle_document};
use serde::Serialize;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};

#[derive(Debug)]
pub struct JsonResponse {
    pub status: u16,
    pub body: String,
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

fn json_response<T: Serialize>(status: u16, body: &T) -> JsonResponse {
    JsonResponse {
        status,
        body: serde_json::to_string(body).expect("response body serializes"),
    }
}

fn error_response(status: u16, message: impl Into<String>) -> JsonResponse {
    json_response(
        status,
        &ErrorBody {
            error: message.into(),
        },
    )
}

pub fn route_json(method: &str, path: &str, body: &str) -> JsonResponse {
    match (method, path) {
        ("OPTIONS", _) => json_response(200, &serde_json::json!({ "ok": true })),
        ("GET", "/health") => json_response(200, &serde_json::json!({ "ok": true })),
        ("POST", "/oracle/parse") => match serde_json::from_str::<OracleParseRequest>(body) {
            Ok(request) => json_response(200, &parse_oracle_document(request)),
            Err(error) => error_response(400, format!("Invalid Oracle parse request: {}", error)),
        },
        ("POST", "/game/decision-options") => match serde_json::from_str::<DecisionRequest>(body) {
            Ok(request) => json_response(200, &build_player_decision_options(request)),
            Err(error) => error_response(400, format!("Invalid decision request: {}", error)),
        },
        _ => error_response(404, "Not found"),
    }
}

fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        _ => "OK",
    }
}

fn handle_stream(mut stream: TcpStream) -> std::io::Result<()> {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 4096];
    loop {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }

    let request = String::from_utf8_lossy(&buffer);
    let mut lines = request.lines();
    let Some(request_line) = lines.next() else {
        return Ok(());
    };
    let parts = request_line.split_whitespace().collect::<Vec<_>>();
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let path = parts[1].split('?').next().unwrap_or(parts[1]);
    let content_length = lines
        .clone()
        .find_map(|line| {
            line.split_once(':').and_then(|(key, value)| {
                key.eq_ignore_ascii_case("content-length")
                    .then(|| value.trim().parse::<usize>().ok())
                    .flatten()
            })
        })
        .unwrap_or(0);
    let header_end = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| index + 4)
        .unwrap_or(buffer.len());
    let mut body = buffer[header_end..].to_vec();
    while body.len() < content_length {
        let read = stream.read(&mut chunk)?;
        if read == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..read]);
    }

    let body = String::from_utf8_lossy(&body);
    let response = route_json(method, path, &body);
    let http = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        response.status,
        reason_phrase(response.status),
        response.body.len(),
        response.body,
    );
    stream.write_all(http.as_bytes())?;
    stream.flush()
}

pub fn serve(addr: &str) -> std::io::Result<()> {
    let listener = TcpListener::bind(addr)?;
    println!("mtg-engine listening on http://{}", addr);
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                if let Err(error) = handle_stream(stream) {
                    eprintln!("request failed: {}", error);
                }
            }
            Err(error) => eprintln!("connection failed: {}", error),
        }
    }

    Ok(())
}
