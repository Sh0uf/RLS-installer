# RLS Installer

A desktop mod installer for the RLS Career Overhaul mods for BeamNG.drive.
Install and update your favorite RLS mods with one click.

## Installation

1. **Prerequisites**: Make sure BeamNG.drive is installed and you've launched it at least once.
2. **Download**: Get the latest RLS Installer from your distribution source (e.g., GitHub Releases).
3. **Install**: Run the installer and follow any Windows security prompts.
4. **Launch**: Start RLS Installer—it will automatically detect your BeamNG mods folder.

## How to Use

### First Time Setup

When you first open RLS Installer, it will automatically point to the default BeamNG mods directory. If the path isnt correct open options and select the correct directory.

### Installing Mods

1. Browse the **Featured Mods** tab to see all publicly available mods from RLS Studio
2. Mods are organized by type:
   - **Core**: Essential RLS Career Overhaul mods
   - **Map**: Custom maps that gives you more to do
   - **Vehicle**: Custom vehicles like the Bruckell Ravix
3. Click any mod card to install it—the app will download and place it in your mods folder automatically
4. Already installed mods show their version number and display an "Update" button when newer versions are available
5. Installing a update will automaticly remove the old version of the mod to avoid issues when starting the game

### Managing Your Library

Switch to the **Library** tab to see all installed mods. From here you can:

- View which non-repo mods you have installed
- Delete mods you no longer want
- Export a list of all installed mods

### Rescan Feature

If you manually add or remove mod files:

1. Use the rescan button to refresh the installer's view
2. The app will detect any changes and update its records

## ❓ Troubleshooting

**Mods folder not detected?**  

- Make sure BeamNG.drive is installed and you've launched it at least once
- The expected path is: `%LOCALAPPDATA%\BeamNG\BeamNG.drive\current\mods`

**Download fails?**  

- Check your internet connection
- Make sure the download URL is valid and accessible

**Mod doesn't show in BeamNG?**  

- Make sure the mod was fully downloaded (check the Library tab)
- Try restarting BeamNG.drive
- Use the rescan feature in the installer

---

<details>
<summary><h2>👨‍💻 Developer Guide (Click to Expand)</h2></summary>

This section is for developers who want to fork this project, contribute, or adapt it for their own mod collections.

## Architecture Overview

RLS Installer is built with:

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Rust + Tauri 2
- **Package Manager**: npm

### Project Structure

```
RLS-installer/
├── src/                          # React frontend
│   ├── App.tsx                   # Main application component
│   ├── types.ts                  # TypeScript type definitions
│   ├── components/               # UI components
│   │   ├── BrowseView.tsx       # Mod catalog display
│   │   ├── InstalledModsTable.tsx
│   │   ├── HeaderBar.tsx
│   │   ├── Sidebar.tsx
│   │   └── ...
│   └── utils/                    # Helper functions
│       ├── version.ts            # Version comparison logic
│       └── cn.ts                 # Tailwind utility
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs               # Tauri commands & core logic
│   │   └── main.rs              # Entry point
│   ├── tauri.conf.json          # Tauri configuration
│   ├── build.rs                 # Build-time env variable handling
│   └── Cargo.toml               # Rust dependencies
├── public/
│   └── mods.json                # Mod catalog (fallback/default)
└── package.json                 # Node dependencies
```

## Setting Up Development Environment

### Prerequisites

1. **Rust** (stable, 2021 edition or later)
2. **Node.js** (v18+ LTS recommended)
3. **Tauri Prerequisites for Windows**:
   - MSVC toolchain
   - WebView2 Runtime
   - See [Tauri Prerequisites](https://tauri.app/v2/guides/prerequisites)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd RLS-installer

# Install Node dependencies
npm install

# Create .env file in src-tauri/ (see Configuration section)
```

### Development

Run in development mode with hot reload:

```bash
npm run tauri dev
```

This starts Vite dev server for the frontend and launches the Tauri application.

### Building

Create production build:

```bash
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

## Configuration

### Optional: Runtime Configuration

You can set this environment variable at runtime to use a remote mod catalog:

```env
# Remote URL for mod catalog (instead of bundled mods.json)
REMOTE_MODS_JSON_URL=https://github.com/yourname/rls-installer/public/mods.json
```

This allows you to update the mod catalog without rebuilding the app.

## Adding Your Own Mods to the Catalog

The mod catalog is defined in `public/mods.json`. This is the core file you'll edit to add/update mods.

### Mod Catalog Schema

Each mod entry requires:

```json
{
  "id": "unique_mod_identifier",
  "name": "Display Name",
  "description": "Brief description (optional)",
  "category": "core" | "map" | "vehicle",
  "state": "Public" | "Beta",
  "directDownload": "https://direct-download-url.com/file.zip",
  "version": "1.0.0",
  "imageUrl": "./imgs/mod-thumbnail.png",
  "assetPattern": "regex_pattern_to_match_filename\\.zip$"
}
```

### Field Explanations

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique identifier (use snake_case, e.g., `rls_career_overhaul`) |
| `name` | ✅ | Display name shown in the UI |
| `description` | ❌ | Brief description (currently not displayed in UI) |
| `category` | ✅ | Type: `"core"`, `"map"`, or `"vehicle"` |
| `state` | ✅ | `"Public"` or `"Beta"` (affects badge display) |
| `directDownload` | ✅ | Direct download URL for the mod zip file |
| `version` | ✅ | Current version string (e.g., `"2.6.2"` or `"2.6.2_hotfix"`) |
| `imageUrl` | ✅ | Path to thumbnail image (place in `public/imgs/`) |
| `assetPattern` | ⚠️ | Regex pattern to match installed zip filenames |

### Example: Adding a New Mod

1. **Add thumbnail image**: Place a PNG/JPG in `public/imgs/my-mod.png`

2. **Add entry to mods.json**:

```json
{
  "id": "my_custom_mod",
  "name": "My Custom Mod",
  "description": "An awesome new mod",
  "category": "vehicle",
  "state": "Public",
  "directDownload": "https://github.com/user/repo/releases/latest/download/my_custom_mod_1.0.0.zip",
  "version": "1.0.0",
  "imageUrl": "./imgs/my-mod.png",
  "assetPattern": "my_custom_mod_\\d+\\.\\d+\\.\\d+\\.zip$"
}
```

1. **Rebuild the app**:

```bash
npm run tauri build
```

### Asset Pattern Tips

The `assetPattern` is a regex used to:

- Match installed mod files in the BeamNG mods folder
- Extract version numbers from filenames

**Common patterns:**

- Semantic versioning: `"mod_name_\\d+\\.\\d+\\.\\d+\\.zip$"`
- With hotfix: `"mod_name_\\d+\\.\\d+\\.\\d+(_hotfix)?\\.zip$"`
- Flexible: `"^mod_name.*\\.zip$"` (matches any version format)

**Important**: Escape dots with `\\` and use `$` to match end of filename.

### Remote Mod Catalog

Instead of bundling `mods.json`, you can host it remotely:

**Option 1: GitHub Raw Content (Recommended)**

1. Push your `mods.json` to a GitHub repository
2. Use the raw content URL:

   ```env
   REMOTE_MODS_JSON_URL=https://raw.githubusercontent.com/yourname/rls-installer/main/public/mods.json
   ```

3. The app will fetch from this URL first, falling back to bundled version if it fails

**Option 2: GitHub Pages**

1. Enable GitHub Pages for your repository
2. Use the Pages URL:

   ```env
   REMOTE_MODS_JSON_URL=https://yourname.github.io/rls-installer/mods.json
   ```

**Option 3: Any Public CDN/Server**

Any publicly accessible HTTPS URL works:

```env
REMOTE_MODS_JSON_URL=https://your-cdn.com/path/to/mods.json
```

This allows updating the mod catalog without rebuilding the app—just update the file on GitHub/your server!

## Code Structure Deep Dive

### Frontend (React)

**App.tsx** (890+ lines—consider refactoring):

- State management for mods, manifest, downloads
- Install/update/delete operations
- Manifest synchronization

**Key Functions:**

- `init()`: Loads config, detects BeamNG path, loads manifest
- `rescanInstalledMods()`: Syncs manifest with actual files on disk
- `installMod()`: Downloads and installs a mod
- `getInstalledForMod()`: Checks if mod is installed and returns version

**Components:**

- `BrowseView`: Grid of mod cards with install buttons
- `InstalledModsTable`: List of installed mods with actions
- `HeaderBar`: App title and window controls
- `Sidebar`: Tab navigation
- `Notifications`: Toast messages

### Backend (Rust)

**lib.rs** (587 lines):

**Tauri Commands** (callable from frontend):

- `detect_beamng_user_path()`: Auto-detects BeamNG mods folder
- `download_mod()`: Downloads file with progress events
- `scan_mods_folder()`: Lists all .zip files in mods folder
- `get_manifest_path()`: Returns path to mod_manifest.json
- `save_manifest()` / `read_manifest()`: Manifest I/O
- `delete_old_mod()`: Removes old mod file
- `get_patreon_config()`: Returns remote catalog URL (legacy name)

**Key Features:**

- Streaming downloads with progress events
- Content-Disposition filename detection
- Manifest migration from old locations
- Permission error handling (Windows-specific)

## Common Development Tasks

### Adding a New Tauri Command

1. **Add command to lib.rs**:

```rust
#[tauri::command]
fn my_new_command(param: String) -> Result<String, String> {
    // Your logic here
    Ok("Success".to_string())
}
```

1. **Register in main.rs**:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    my_new_command
])
```

1. **Call from frontend**:

```typescript
import { invoke } from "@tauri-apps/api/core";

const result = await invoke<string>("my_new_command", { param: "value" });
```

### Updating the UI Theme

Colors are defined in `src/App.css` using CSS variables:

```css
:root {
  --primary: #your-color;
  --secondary: #your-color;
  --accent: #your-color;
}
```

Tailwind classes use these: `bg-primary`, `text-accent`, etc.

### Version Comparison Logic

Version comparison is in `src/utils/version.ts`. It handles:

- Semantic versioning (1.2.3)
- Hotfix versions (2.6.2_hotfix)
- Beta/alpha versions
- Date-based versions

Modify `isNewerVersion()` if you need custom version logic.

## Testing Your Changes

1. **Development testing**: Use `npm run tauri dev` for rapid iteration
2. **Build testing**: Create production build and test on clean system
3. **Manifest testing**: Test install/uninstall/rescan scenarios
4. **Edge cases**: Test with missing mods folder, no internet, invalid configs

## Code Quality Notes

Current technical debt and improvement opportunities:

- **App.tsx is too large** (~900 lines): Should be split into custom hooks and smaller components
- **Error handling**: Could be more user-friendly with structured error types
- **Type safety**: Some `any` types could be eliminated
- **Testing**: No automated tests currently—consider adding Jest/Vitest
- **Async I/O**: Rust filesystem operations could use `tokio::fs` for consistency

## Building for Distribution

### Release Checklist

1. Update version in `src-tauri/tauri.conf.json`
2. Update version in `package.json`
3. Test on clean Windows install
4. Run `npm run tauri build`
5. Test the installer bundle
6. Create release notes
7. Upload to distribution channel

### Updater Configuration

Tauri supports built-in app updates. See `tauri.conf.json`:

```json
"updater": {
  "active": true,
  "endpoints": ["https://your-update-server.com/{{target}}/{{current_version}}"],
  "dialog": true,
  "pubkey": "YOUR_PUBLIC_KEY"
}
```

Generate update signature with Tauri CLI.

## License

Specify your license here (MIT, Apache 2.0, GPL, etc.).

## Contributing

If you're forking this project:

1. Update `public/mods.json` with your mods
2. Replace images in `public/imgs/`
3. Update app name in `src-tauri/tauri.conf.json`
4. Update this README
5. Optionally set up a remote mod catalog URL

---

**Questions?** Open an issue or contact the maintainers.

</details>
