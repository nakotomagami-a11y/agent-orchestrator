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
                use std::process::Command;
                use tauri::Manager;

                let resource_dir = app
                    .path()
                    .resource_dir()
                    .expect("resource dir not found");

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
                    .env("NODE_ENV", "production");

                // Don't flash a console window when launching Node on Windows.
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                    command.creation_flags(CREATE_NO_WINDOW);
                }

                let child = command
                    .spawn()
                    .expect("failed to spawn bundled server");

                *server_setup.lock().unwrap() = Some(child);

                if !wait_for_port(5173, 30) {
                    panic!("server did not become ready within 30 s");
                }
            }

            // Suppress unused-variable warning in debug builds where the
            // server_setup block above is compiled out.
            #[cfg(debug_assertions)]
            let _ = &server_setup;

            WebviewWindowBuilder::new(
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
            .build()?;

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
