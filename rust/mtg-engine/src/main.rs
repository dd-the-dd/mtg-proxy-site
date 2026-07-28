use mtg_engine::http::serve;

fn main() -> std::io::Result<()> {
    let addr = std::env::var("MTG_ENGINE_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".to_string());
    serve(&addr)
}
