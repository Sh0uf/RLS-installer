use std::path::PathBuf;
use std::fs;
use std::io::{Write, ErrorKind};
use futures_util::StreamExt;
use serde::Serialize;
use tauri::Emitter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn detect_beamng_user_path() -> Result<String, String> {
    // Attempt to automatically find the BeamNG user folder on Windows
    // %LOCALAPPDATA%/BeamNG.drive/latest/mods
    let local_app_data = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
    let path = PathBuf::from(local_app_data)
        .join("BeamNG")
        .join("BeamNG.drive")
        .join("current") // "latest" is often a symlink or folder in BeamNG user path
        .join("mods");
    // Consider creating it if it doesn't exist?
    // For now, just return the path.
    if !path.exists() {
        // It might be risky to say it failed if the user just installed the game and hasn't run it,
        // but typically the folder structure exists.
        // We can optionally create it:
        // fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_old_mod(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        // If it doesn't exist, that's fine too, essentially "deleted"
        return Ok(format!("File {} did not exist", file_path));
    }

    match fs::remove_file(&path) {
        Ok(_) => Ok(format!("Deleted {}", file_path)),
        Err(e) => {
            // If Windows reports access denied but the file is effectively
            // gone or will be removed shortly, we do not want to surface a
            // scary error to the user. Treat PermissionDenied as a soft
            // success and let the front-end refresh its view.
            if e.kind() == ErrorKind::PermissionDenied {
                return Ok(format!(
                    "Delete reported access denied for {}, continuing", file_path
                ));
            }

            // On Windows it's possible to see transient errors even when the
            // file ultimately disappears. If the file is gone after the
            // error, treat this as a success to avoid noisy false failures.
            if !path.exists() {
                Ok(format!("File {} was already deleted", file_path))
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[derive(Serialize, Clone)]
struct DownloadProgressPayload {
    mod_id: Option<String>,
    url: String,
    downloaded: u64,
    total: Option<u64>,
    progress: Option<u8>,
}

#[tauri::command]
async fn download_mod(
    window: tauri::Window,
    url: String,
    target_path: String,
    mod_id: Option<String>,
) -> Result<String, String> {
    // Stream a file download from a URL to the disk.
    // Use a browser-like User-Agent to avoid 403s from some hosts.
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let total_size = res.content_length();

    // Decide final destination path. Default to the requested target_path,
    // but if the server provides a Content-Disposition filename, prefer
    // that name in the same directory so we preserve the original zip name.
    let requested_path = PathBuf::from(&target_path);
    let mut dest_path = requested_path.clone();

    if let Some(content_disposition) = res.headers().get("content-disposition") {
        if let Ok(cd_str) = content_disposition.to_str() {
            if let Some(filename_start) = cd_str.find("filename=\"") {
                let filename_content = &cd_str[filename_start + 10..];
                if let Some(filename_end) = filename_content.find('"') {
                    let filename = &filename_content[..filename_end];
                    if !filename.is_empty() {
                        if let Some(parent) = requested_path.parent() {
                            dest_path = parent.join(filename);
                        }
                    }
                }
            }
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emitted: u8 = 0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let chunk_len = chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        downloaded = downloaded.saturating_add(chunk_len);

        if let Some(total) = total_size {
            if total > 0 {
                let pct = ((downloaded as f64 / total as f64) * 100.0).round() as u8;
                if pct != last_emitted && pct <= 100 {
                    last_emitted = pct;
                    let payload = DownloadProgressPayload {
                        mod_id: mod_id.clone(),
                        url: url.clone(),
                        downloaded,
                        total: Some(total),
                        progress: Some(pct),
                    };
                    if let Err(e) = window.emit("download_progress", payload) {
                        eprintln!("Failed to emit download_progress event: {}", e);
                    }
                }
            }
        }
    }

    let response = serde_json::json!({
        "path": dest_path.to_string_lossy(),
        "filename": dest_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default()
    })
    .to_string();

    Ok(response)
}

#[tauri::command]
async fn download_mod_with_auth(url: String, target_path: String, auth_token: Option<String>) -> Result<String, String> {
    // Stream a file download from a URL to the disk, with optional OAuth Bearer token
    // This is used for Patreon downloads that require authentication
    // Returns JSON: {"path": "...", "filename": "..."}
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let mut request = client.get(&url);
    
    // Add Authorization header if token provided (for Patreon downloads)
    if let Some(token) = auth_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    let res = request.send().await.map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_default();
        return Err(format!("Download failed with status {}: {}", status, error_body));
    }

    // Extract filename from Content-Disposition header if available
    let mut actual_filename: Option<String> = None;
    if let Some(content_disposition) = res.headers().get("content-disposition") {
        if let Ok(cd_str) = content_disposition.to_str() {
            // Parse: attachment; filename="rls_career_overhaul_2.6.2.zip"
            if let Some(filename_start) = cd_str.find("filename=\"") {
                let filename_content = &cd_str[filename_start + 10..];
                if let Some(filename_end) = filename_content.find('"') {
                    actual_filename = Some(filename_content[..filename_end].to_string());
                }
            }
        }
    }

    let dest_path = PathBuf::from(&target_path);
    
    // Ensure parent directory exists
    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
    }

    // Return JSON with actual filename if available
    let response = if let Some(filename) = actual_filename {
        serde_json::json!({
            "path": target_path,
            "filename": filename
        }).to_string()
    } else {
        serde_json::json!({
            "path": target_path,
            "filename": null
        }).to_string()
    };

    Ok(response)
}

#[tauri::command]
fn save_manifest(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_manifest(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

// Return the path to mod_manifest.json located in a per-user
// RLS Installer data directory under LOCALAPPDATA. If an older
// manifest exists next to the executable (from previous versions
// installed under Program Files), attempt a one-time migration.
#[tauri::command]
fn get_manifest_path() -> Result<String, String> {
    let local_app_data = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
    let data_dir = PathBuf::from(local_app_data).join("RLS Installer");

    if let Err(e) = fs::create_dir_all(&data_dir) {
        return Err(e.to_string());
    }

    let manifest_path = data_dir.join("mod_manifest.json");

    // One-time migration from old location next to the executable
    if !manifest_path.exists() {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(exe_dir) = exe.parent() {
                let old_manifest = exe_dir.join("mod_manifest.json");
                if old_manifest.exists() {
                    if let Err(e) = fs::copy(&old_manifest, &manifest_path) {
                        eprintln!("Failed to migrate manifest from {:?} to {:?}: {}", old_manifest, manifest_path, e);
                    }
                }
            }
        }
    }

    Ok(manifest_path.to_string_lossy().to_string())
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_mods_folder(path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() {
        return Ok(files);
    }
    
    let dir = fs::read_dir(dir_path).map_err(|e| e.to_string())?;
    for entry in dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().to_lowercase() == "zip" {
                    if let Some(name) = path.file_name() {
                        files.push(name.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn patreon_login<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<String, String> {
    use tauri_plugin_opener::OpenerExt;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;

    // NOTE: Patreon login is unused in this public-only build.
    // We keep the implementation for potential future use, but
    // read client id/secret at runtime so missing env vars do
    // not break compilation.
    let client_id = std::env::var("PATREON_CLIENT_ID").unwrap_or_default();
    let client_secret = std::env::var("PATREON_CLIENT_SECRET").unwrap_or_default();

    if client_id.is_empty() || client_secret.is_empty() {
        return Err("Patreon login is not configured for this build.".into());
    }
    let redirect_uri = "http://localhost:31415";

    let listener = TcpListener::bind("127.0.0.1:31415").map_err(|e| e.to_string())?;
    
    // Construct Auth URL - request identity.memberships to see which campaigns user is a patron of
    let auth_url = format!(
        "https://www.patreon.com/oauth2/authorize?response_type=code&client_id={}&redirect_uri={}&scope=identity%20identity.memberships%20campaigns.posts",
        client_id, redirect_uri
    );

    // Open Browser
    app.opener().open_url(auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for connection (Blocking the thread is fine here as it is an async command running on threadpool)
    // Accept one connection
    let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
    
    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).map_err(|e| e.to_string())?;

    // format: GET /?code=ABC... HTTP/1.1
    let code = if let Some(start) = request_line.find("code=") {
        let remainder = &request_line[start + 5..];
        
        // Find the end of the token: either a space (end of URL in request line) or an '&' (next param)
        let end_space = remainder.find(' ').unwrap_or(remainder.len());
        let end_amp = remainder.find('&').unwrap_or(remainder.len());
        let end = std::cmp::min(end_space, end_amp);
        
        remainder[..end].to_string()
    } else {
        // Send a generic error page
        let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\nNo code found");
        return Err("No code found in redirect".into());
    };

    // Send success response to browser
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<html><body style='font-family:sans-serif;background:#111;color:#eee;display:flex;justify-content:center;align-items:center;height:100%'><div><h1>Login Successful</h1><p>You can close this window and return to RLS Installer.</p><script>window.close()</script></div></body></html>";
    let _ = stream.write_all(response.as_bytes());

    // Exchange code for token
    let client = reqwest::Client::new();
    let params = [
        ("code", code),
        ("grant_type", "authorization_code".to_string()),
        ("client_id", client_id.to_string()),
        ("client_secret", client_secret.to_string()),
        ("redirect_uri", redirect_uri.to_string()),
    ];

    let res = client.post("https://www.patreon.com/api/oauth2/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         let error_text = res.text().await.unwrap_or_default();
         return Err(format!("Token exchange failed: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    if let Some(access_token) = json.get("access_token").and_then(|v| v.as_str()) {
        Ok(access_token.to_string())
    } else {
        Err("No access_token in response".into())
    }
}

#[tauri::command]
async fn fetch_page_content(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
        
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    res.text().await.map_err(|e| e.to_string())
}

// Simple helper to open a URL in the user's default browser
// from the Tauri backend. Used as a fallback for Patreon
// downloads that cannot be fetched with an OAuth token and
// instead must be handled by the logged-in browser session.
#[tauri::command]
async fn open_url_in_browser<R: tauri::Runtime>(app: tauri::AppHandle<R>, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}
/*
// ORIGINAL Patreon campaign fetching helpers (disabled in this build).
// These remain here for reference but are not compiled or exposed
// via Tauri's invoke_handler in this distribution.
//
// To re-enable in a future "official RLS" build:
// 1) Remove this comment block wrapper so the commands compile again.
// 2) Add them back into tauri::generate_handler! in run().

#[tauri::command]
async fn fetch_patreon_campaign_details(token: String, campaign_id: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch campaign details specifically to get the Tiers (Goals/Benefits etc optional)
    // URL Encoded brackets: [ -> %5B, ] -> %5D
    let url = format!(
        "https://www.patreon.com/api/oauth2/v2/campaigns/{}?include=tiers&fields%5Btier%5D=title,amount_cents", 
        campaign_id
    );
    
    let res = client.get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         let status = res.status();
         let txt = res.text().await.unwrap_or_default();
         return Err(format!("Details API Error {}: {}", status, txt));
    }

    res.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_patreon_user_memberships(token: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch user's identity with memberships to see which campaigns they're a patron of
    let url = "https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.campaign&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,full_name&fields%5Bcampaign%5D=vanity,creation_name,url";
    
    let res = client.get(url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         let status = res.status();
         let txt = res.text().await.unwrap_or_default();
         return Err(format!("Identity API Error {}: {}", status, txt));
    }

    res.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_patreon_campaign_posts_accessible(token: String, campaign_id: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch posts from a campaign that the authenticated user can access
    // Uses patron-level permissions, not creator permissions
    // Valid post fields: title, url, published_at, content, embed_data, embed_url, is_paid, is_public, tiers, app_id, app_status
    let url = format!(
        "https://www.patreon.com/api/oauth2/v2/campaigns/{}/posts?fields%5Bpost%5D=title,url,published_at,content,embed_data,embed_url,is_paid,is_public&page%5Bcount%5D=100",
        campaign_id
    );
    
    let res = client.get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         let status = res.status();
         let txt = res.text().await.unwrap_or_default();
         return Err(format!("Campaign Posts API Error {}: {}", status, txt));
    }

    res.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn fetch_patreon_campaign(token: String, campaign_id: String) -> Result<String, String> {
    // This is the OLD endpoint that requires creator permissions
    // Keeping for backwards compatibility but should use fetch_patreon_campaign_posts_accessible instead
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://www.patreon.com/api/oauth2/v2/campaigns/{}/posts?fields%5Bpost%5D=title,url,is_public,published_at,tiers&page%5Bcount%5D=100", 
        campaign_id
    );
    
    let res = client.get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
         let status = res.status();
         let txt = res.text().await.unwrap_or_default();
         return Err(format!("Posts API Error {}: {}", status, txt));
    }

    res.text().await.map_err(|e| e.to_string())
}
*/

#[derive(serde::Serialize)]
struct BackendConfig {
    remote_mods_json_url: String,
}

#[tauri::command]
fn get_patreon_config() -> BackendConfig {
    // Resolve remote_mods_json_url with this priority:
    // 1) Runtime env REMOTE_MODS_JSON_URL (for local testing/overrides)
    // 2) Build-time REMOTE_MODS_JSON_URL via option_env! (for CI/Release builds)
    // 3) Empty string (falls back to bundled public/mods.json)

    let runtime_url = std::env::var("REMOTE_MODS_JSON_URL").ok().filter(|s| !s.is_empty());
    let buildtime_url = option_env!("REMOTE_MODS_JSON_URL").map(|s| s.to_string()).filter(|s| !s.is_empty());

    let remote_url = runtime_url
        .or(buildtime_url)
        .unwrap_or_default();

    BackendConfig {
        remote_mods_json_url: remote_url,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            detect_beamng_user_path,
            delete_old_mod,
            download_mod,
            download_mod_with_auth,
            rename_file,
            save_manifest,
            read_manifest,
            get_manifest_path,
            scan_mods_folder,
            patreon_login,
            fetch_page_content,
            open_url_in_browser,
            get_patreon_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}