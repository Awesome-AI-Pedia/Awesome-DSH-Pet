// 二进制入口：单独一个 main.rs，把逻辑委托给 lib.rs（Tauri v2 官方推荐布局，
// 便于 mobile 复用 pub fn run()）。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    awesome_dsh_pet_desktop_lib::run()
}
