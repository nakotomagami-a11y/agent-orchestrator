use std::process::Child;
use std::sync::{Arc, Mutex};
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[cfg(not(debug_assertions))]
fn wait_for_port(port: u16, timeout_secs: u64) -> bool {
    use std::net::TcpStream;
    use std::time::{Duration, Instant};
    let addr = format!("127.0.0.1:{port}");
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        if TcpStream::connect(&addr).is_ok() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

// Append a line to %TEMP%/agent-office-launch.log. The release app is a GUI
// process with no console, so this file is the only way to see startup errors.
#[cfg(not(debug_assertions))]
fn launch_log(msg: &str) {
    use std::io::Write;
    let p = std::env::temp_dir().join("agent-office-launch.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&p) {
        let _ = writeln!(f, "{msg}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let server_setup = server.clone();
    let server_close = server.clone();

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(not(debug_assertions))]
            {
                use std::process::{Command, Stdio};
                use tauri::Manager;

                launch_log("=== launch start ===");
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .expect("resource dir not found");
                // On Windows resource_dir() can carry the \\?\ extended-length
                // prefix. Node mishandles it — server.js's __dirname-relative
                // module resolution breaks and the server never listens — so
                // normalize it away before deriving the paths we hand to Node.
                #[cfg(windows)]
                let resource_dir = {
                    let s = resource_dir.to_string_lossy();
                    match s.strip_prefix(r"\\?\") {
                        Some(rest) => std::path::PathBuf::from(rest),
                        None => resource_dir.clone(),
                    }
                };
                launch_log(&format!("resource_dir = {}", resource_dir.display()));

                // Bundled Node.js runtime. prepare-bundle.mjs writes the host
                // platform's `node` here under a platform-neutral name (only the
                // Windows build carries the `.exe` suffix). Supporting a new OS
                // needs no change beyond this single cfg!(windows) check.
                let node_name = if cfg!(windows) { "node-runtime.exe" } else { "node-runtime" };
                let node_bin = resource_dir.join("binaries").join(node_name);

                // pnpm monorepo: standalone output nests the app under apps/web/
                let server_js = resource_dir
                    .join("server")
                    .join("apps")
                    .join("web")
                    .join("server.js");

                // On Unix the bundled binary can lose its exec bit through
                // packaging; restore it. Not applicable on Windows.
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(meta) = std::fs::metadata(&node_bin) {
                        let mut perms = meta.permissions();
                        perms.set_mode(0o755);
                        // Ignore error — dpkg installs binaries root-owned; already executable.
                        let _ = std::fs::set_permissions(&node_bin, perms);
                    }
                }

                let mut command = Command::new(&node_bin);
                command
                    .arg(&server_js)
                    .env("PORT", "5173")
                    .env("HOSTNAME", "127.0.0.1")
                    .env("NODE_ENV", "production")
                    // Give the child explicit null stdio. app.exe is a GUI
                    // (windows_subsystem = "windows") process with no console, so
                    // inheriting its invalid stdio handles makes Node abort on
                    // startup before it can listen — the app then panics in
                    // wait_for_port and exits. Null handles are valid everywhere.
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());

                // Don't flash a console window when launching Node on Windows.
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    command.creation_flags(CREATE_NO_WINDOW);
                }

                launch_log(&format!(
                    "node_bin = {} (exists {}), server_js = {} (exists {})",
                    node_bin.display(), node_bin.exists(),
                    server_js.display(), server_js.exists(),
                ));

                match command.spawn() {
                    Ok(child) => {
                        launch_log("server spawn OK");
                        *server_setup.lock().unwrap() = Some(child);
                    }
                    Err(e) => {
                        launch_log(&format!("server spawn ERROR: {e}"));
                        panic!("failed to spawn bundled server: {e}");
                    }
                }

                let ready = wait_for_port(5173, 30);
                launch_log(&format!("wait_for_port(5173) = {ready}"));
                if !ready {
                    panic!("server did not become ready within 30 s");
                }
                launch_log("server ready — building window");
            }

            // Suppress unused-variable warning in debug builds where the
            // server_setup block above is compiled out.
            #[cfg(debug_assertions)]
            let _ = &server_setup;

            let window_result = WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External("http://localhost:5173".parse().unwrap()),
            )
            .title("Agent Office")
            .inner_size(1400.0, 900.0)
            .min_inner_size(1100.0, 720.0)
            .resizable(true)
            .fullscreen(false)
            .decorations(false)
            .transparent(true)
            .center()
            .build();
            #[cfg(not(debug_assertions))]
            launch_log(&match &window_result {
                Ok(_) => String::from("window build OK"),
                Err(e) => format!("window build ERROR: {e}"),
            });
            window_result?;

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    if let Ok(mut guard) = server_close.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
