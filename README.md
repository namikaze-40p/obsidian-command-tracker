# Obsidian Command Tracker

This is an [Obsidian](https://obsidian.md/) plugin which tracks the number of times the command is used.

This plugin helps optimize the plugins and hotkeys used.  
You can check the date of last use of each command and how much times each command is used daily.

- If you find a command you use frequently from the command palette, you may want to assign a hotkey to it.
- If a hotkey which a command assigned is rarely used, you may want to consider ceding the hotkey to another command (or uninstall the target plugin).

![demo](https://raw.githubusercontent.com/namikaze-40p/obsidian-command-tracker/main/demo/command-tracker-view.gif)

## How to use

1. When a command is executed, this plugin records it.
1. `Command Tracker: View command tracker` command to view recorded information.

> [!NOTE]
>
> - Supported: The following command execution methods.
>   - Use hotkeys.
>   - Select from command palette.
> - Not supported: Other command execution methods.
>   - Example, select from the Ribbon, execute by UI operation and etc...
> - Known bugs:
>   - When you restart Obsidian with the `Command Tracker View` tab open, the hotkeys don't appear in the table.
>     - If you close and reopen the `Command Tracker View` tab, the hot keys will appear in the table.

> [!TIP]
>
> - Location of recorded data
>   - The history of command usage is recorded in [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology).

> [!CAUTION]
>
> - Data of “Command Tracker” is deleted in the following cases.
>   - All data is deleted in the following cases.
>     - When the "Delete all data" operation in the settings.
>     - When this plugin is updated.
>     - When this plugin is disabled.
>     - When this plugin is uninstalled.
>   - Some data is deleted in the following cases.
>     - When the number of records exceeds 2000 lines and a new record is written, the oldest record is deleted.
>     - When a new record is written, records exceeding 60 days from the date of use are deleted.

## Installation

Install the plugin in one of the following ways.

- [Community Plugins browser (In preparation)](#community-plugins-browser-in-preparation)
- [Manually](#manually)
- [BRAT Plugin Manager](#brat-plugin-manager)

### Community Plugins browser (In preparation)

It's not on the community plugin yet, because now waiting Obsidian team for review.

<!-- This plugin is available in Obsidian's Community Plugins Browser.

1. Launch the Obsidian application.
1. Open the `Settings`, select `Community Plugins`, and select `Browse`.
1. Search for `Command Tracker`, and click it.
1. Click the `Install`. -->

### Manually

You can also install this plugin manually.

1. Access to [Releases](https://github.com/namikaze-40p/obsidian-command-tracker/releases), and download the 3 files(`main.js`, `manifest.json`, `style.css`) of latest version.
1. Create a new folder named `command-tracker`.
1. Move download the 3 files to the `command-tracker` folder.
1. Place the folder in your `.obsidian/plugins` directory. If you don't know where that is, you can go to Community Plugins inside Obsidian. There is a folder icon on the right of Installed Plugins. Click that and it opens your plugins folder.
1. Reload plugins. (the easiest way is just restarting Obsidian)
1. Activate the plugin as normal.

### BRAT Plugin Manager

You can also install this plugin using the BRAT plugin.

1. Install BRAT using the Obsidian Plugin manager
1. In your Obsidian settings on the left, select BRAT in the list.
1. In BRAT settings, click the button Add Beta Plugin
1. In the textbox, supply the URL to this repo => `https://github.com/namikaze-40p/obsidian-command-tracker`
1. Once `Command Tracker` is installed, activate it in your Obsidian settings.
