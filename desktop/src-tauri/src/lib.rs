// 桌面宠物 Tauri v2 入口。
// 关键窗口特性由 tauri.conf.json 声明：transparent / decorations:false /
// alwaysOnTop / skipTaskbar / shadow:false / focus:false / acceptFirstMouse。
//
// 本文件负责：
// 1. 从 CLI/环境/配置文件解析 dsh base URL，注入到 webview 全局；
// 2. 首次启动把窗口放到屏幕右下角（22px inset）；
// 3. 暴露自定义命令：set_ignore_cursor_events / quit_app。

use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{Emitter, Manager, PhysicalPosition, State, WebviewWindow};

const DSH_URL_ENV: &str = "DSH_BASE_URL";
const DEFAULT_DSH_URL: &str = "http://127.0.0.1:8080";

#[derive(Debug, Default, Serialize, Deserialize)]
struct DesktopConfig {
    dsh_base_url: Option<String>,
}

#[derive(Clone)]
struct DshHttp {
    base_url: String,
    client: reqwest::Client,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DshResponse {
    status: u16,
    content_type: Option<String>,
    body: Vec<u8>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HitRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Default)]
struct PointerPassthrough {
    regions: Arc<Mutex<Vec<HitRect>>>,
}

fn cursor_hits_regions(
    cursor: PhysicalPosition<f64>,
    window_origin: PhysicalPosition<i32>,
    scale: f64,
    regions: &[HitRect],
) -> bool {
    regions.iter().any(|region| {
        let left = window_origin.x as f64 + region.x * scale;
        let top = window_origin.y as f64 + region.y * scale;
        let right = left + region.width * scale;
        let bottom = top + region.height * scale;
        cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom
    })
}

fn start_pointer_passthrough(window: WebviewWindow, state: PointerPassthrough) {
    thread::spawn(move || {
        let mut last_ignore = None;
        loop {
            let regions = state
                .regions
                .lock()
                .map(|value| value.clone())
                .unwrap_or_default();
            let inside = match (
                window.cursor_position(),
                window.outer_position(),
                window.scale_factor(),
            ) {
                (Ok(cursor), Ok(origin), Ok(scale)) => {
                    cursor_hits_regions(cursor, origin, scale, &regions)
                }
                _ => false,
            };
            let ignore = !inside;
            if last_ignore != Some(ignore) && window.set_ignore_cursor_events(!inside).is_ok() {
                last_ignore = Some(ignore);
            }
            thread::sleep(Duration::from_millis(30));
        }
    });
}

fn config_path() -> Option<PathBuf> {
    // macOS: ~/Library/Application Support/com.yuki22.awesome-dsh-pet/config.json
    // Linux/Windows: dirs::config_dir() 类似位置
    let home = env::var_os("HOME").map(PathBuf::from)?;
    #[cfg(target_os = "macos")]
    let dir = home
        .join("Library")
        .join("Application Support")
        .join("com.yuki22.awesome-dsh-pet");
    #[cfg(not(target_os = "macos"))]
    let dir = home.join(".config").join("awesome-dsh-pet");
    Some(dir.join("config.json"))
}

fn load_config() -> DesktopConfig {
    let Some(path) = config_path() else {
        return DesktopConfig::default();
    };
    let Ok(bytes) = fs::read(&path) else {
        return DesktopConfig::default();
    };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn resolve_dsh_url(cli_args: &[String]) -> String {
    // 优先级：CLI --dsh-url=... > 环境变量 DSH_BASE_URL > 配置文件 > 默认值
    for arg in cli_args {
        if let Some(rest) = arg.strip_prefix("--dsh-url=") {
            return rest.to_string();
        }
    }
    if let Ok(v) = env::var(DSH_URL_ENV) {
        if !v.is_empty() {
            return v;
        }
    }
    if let Some(v) = load_config().dsh_base_url {
        if !v.is_empty() {
            return v;
        }
    }
    DEFAULT_DSH_URL.to_string()
}

#[tauri::command]
fn set_ignore_cursor_events(window: WebviewWindow, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_pet_hit_regions(
    state: State<'_, PointerPassthrough>,
    regions: Vec<HitRect>,
) -> Result<(), String> {
    let regions = regions
        .into_iter()
        .filter(|region| {
            region.x.is_finite()
                && region.y.is_finite()
                && region.width.is_finite()
                && region.height.is_finite()
                && region.width > 0.0
                && region.height > 0.0
        })
        .collect();
    *state.regions.lock().map_err(|error| error.to_string())? = regions;
    Ok(())
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn dsh_request(
    state: State<'_, DshHttp>,
    method: String,
    path: String,
    body: Option<Vec<u8>>,
    content_type: Option<String>,
) -> Result<DshResponse, String> {
    let route = path.split('?').next().unwrap_or_default();
    let allowed = route == "/awesome-dsh-pet" || route.starts_with("/awesome-dsh-pet/");
    if !allowed || route.split('/').any(|part| part == "..") {
        return Err("invalid awesome-dsh-pet route".to_string());
    }

    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("unsupported HTTP method".to_string()),
    };
    let url = format!("{}{}", state.base_url.trim_end_matches('/'), path);
    let mut request = state.client.request(method, url);
    if let Some(value) = content_type {
        request = request.header(reqwest::header::CONTENT_TYPE, value);
    }
    if let Some(bytes) = body {
        request = request.body(bytes);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let body = response.bytes().await.map_err(|e| e.to_string())?.to_vec();
    Ok(DshResponse {
        status,
        content_type,
        body,
    })
}

fn place_bottom_right(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let size = window.outer_size()?;
    let m = monitor.size();
    let inset_x = (22.0 * scale) as i32;
    let inset_y = (80.0 * scale) as i32;
    let x = m.width as i32 - size.width as i32 - inset_x;
    let y = m.height as i32 - size.height as i32 - inset_y;
    window.set_position(PhysicalPosition::new(x, y))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = env::args().skip(1).collect();
    let dsh_url = resolve_dsh_url(&args);
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(500))
        .timeout(Duration::from_secs(4))
        .build()
        .expect("failed to build DSH HTTP client");
    let pointer_passthrough = PointerPassthrough::default();
    let pointer_passthrough_for_setup = pointer_passthrough.clone();

    tauri::Builder::default()
        .manage(DshHttp { base_url: dsh_url.clone(), client })
        .manage(pointer_passthrough)
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(move |app| {
            let window = app.get_webview_window("pet").expect("pet window missing");

            // 注入 dsh base URL 到 webview 全局：main.mjs 读 __DSH_BASE_URL__
            let escaped = dsh_url.replace('\\', "\\\\").replace('\'', "\\'");
            let script = format!(
                "Object.defineProperty(globalThis,'__DSH_BASE_URL__',{{value:'{}',configurable:false,writable:false}});",
                escaped
            );
            let _ = window.eval(&script);

            // 首次放到屏幕右下角（用户可以随后拖动）
            let _ = place_bottom_right(&window);
            start_pointer_passthrough(window.clone(), pointer_passthrough_for_setup.clone());

            // macOS：窗口浮在所有 spaces（切工作区不消失）
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Transparent);
            }

            // 通知前端 base URL（也方便前端排障 log）
            let _ = window.emit("dsh-base-url", &dsh_url);

            // debug 构建自动打开 DevTools（release 不受影响，devtools feature 已按 profile 隔离）
            #[cfg(debug_assertions)]
            if env::var_os("DESKTOP_PET_DEVTOOLS").is_some() {
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_ignore_cursor_events,
            set_pet_hit_regions,
            quit_app,
            dsh_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
