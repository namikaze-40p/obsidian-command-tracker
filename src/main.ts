import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { around } from 'monkey-around'
import { App, Platform, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { CustomApp, CommandPalettePluginInstance, Command, PluginInstance } from './types';
import { CommandTrackerView, VIEW_TYPE_COMMAND_TRACKER } from './view';
import { CommandTrackerDatabase } from './database';
import { ConfirmReloadModal } from './confirm-reload-modal';

dayjs.extend(customParseFormat);

const MAXIMUM_RECORDS = 2000 as const;
const RETENTION_PERIOD = 60 as const;

const RUN_TYPE = {
	hotkey: 'hotkey',
	cmdPalette: 'command-palette',
} as const;

type RunType = typeof RUN_TYPE[keyof typeof RUN_TYPE];

export const getEnabledPluginById = (app: App, pluginId: string): PluginInstance | null => {
	return (app as CustomApp)?.internalPlugins?.getEnabledPluginById(pluginId) || null;
};

export default class CommandTracker extends Plugin {
	settings: Settings;
	private _settingTab: SettingTab;
	private _db: CommandTrackerDatabase;
	private _uninstallWrapper: {
		executeCommand?: () => void,
		onChooseItem?: () => void
	} = {};

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_COMMAND_TRACKER,
			(leaf) => new CommandTrackerView(leaf, this.settings),
		);

		this.addCommand({
			id: 'view-command-tracker',
			name: 'View command tracker',
			callback: async () => this.viewCommandTracker(),
		});

		this._settingTab = new SettingTab(this.app, this);
		this.addSettingTab(this._settingTab);

		this.app.workspace.onLayoutReady(async () => {
			this._db = new CommandTrackerDatabase((this.app as CustomApp).appId);
			await this._db.open();
			const handlingDatabase = this.handlingDatabase.bind(this);
			this._uninstallWrapper.executeCommand = around((this.app as CustomApp).commands, {
				executeCommand(orgMethod): (command: Command, ev: Event) => boolean {
					return (command: Command, ev: Event) => {
						handlingDatabase(command, RUN_TYPE.hotkey);
						return orgMethod && orgMethod.call(this, command, ev);
					};
				},
			});

			const commandPalette = getEnabledPluginById(this.app, 'command-palette') as CommandPalettePluginInstance;
			if (commandPalette) {
				this._uninstallWrapper.onChooseItem = around(commandPalette.modal, {
					onChooseItem(orgMethod): (command: Command, ev: Event) => boolean {
						return (command: Command, ev: Event) => {
							handlingDatabase(command, RUN_TYPE.cmdPalette);
							return orgMethod && orgMethod.call(this, command, ev);
						};
					},
				});
			}
		});

		this.saveCurrentVersionNumber();
	}

	async onunload() {
		if (this._uninstallWrapper.executeCommand) {
			this._uninstallWrapper.executeCommand();
			this._uninstallWrapper.executeCommand = undefined;
		}
		if (this._uninstallWrapper.onChooseItem) {
			this._uninstallWrapper.onChooseItem();
			this._uninstallWrapper.onChooseItem = undefined;
		}
		if (Platform.isDesktopApp && this.settings.viewCommandTracker.isProtectData) {
			this._db.close();
		} else {
			await this._db.deleteDatabase();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async viewCommandTracker(): Promise<void> {
		await this.app.workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_COMMAND_TRACKER, active: true });
	}

	private async handlingDatabase(command: Command, runType: RunType): Promise<void> {
		if (this.settings.viewCommandTracker.isStopTracing) {
			return;
		}
		await this.deleteRecords();
		await this.registerRecord(command, runType);
	}

	private async deleteRecords(): Promise<void> {
		const records = await this._db.getAll();
		if (records.length >= MAXIMUM_RECORDS) {
			const referenceUid = records.length - MAXIMUM_RECORDS + (records[0].uid ?? 0);
			await this._db.deleteExceededRecords(referenceUid);
		}
		const referenceDate = parseInt(dayjs().subtract(RETENTION_PERIOD, 'd').format('YYYYMMDD'), 10);
		await this._db.deleteOverdueRecords(referenceDate);
	}

	private async registerRecord(command: Command, runType: RunType): Promise<void> {
		const date = parseInt(dayjs().format('YYYYMMDD'), 10);
		const usedCommands = await this._db.searchSameDateAndId(date, command.id);
		const usedCommand = usedCommands.length ? usedCommands[0] : null;
		if (usedCommand) {
			const { uid = 0, hotkeyCount = 0, cmdPaletteCount = 0 } = usedCommand;
			if (runType === RUN_TYPE.hotkey) {
				await this._db.update(uid, { hotkeyCount: hotkeyCount + 1 });
			} else {
				await this._db.update(uid, { cmdPaletteCount: cmdPaletteCount + 1 });
			}
		} else {
			const counts = {
				hotkeyCount: runType === RUN_TYPE.hotkey ? 1 : 0,
				cmdPaletteCount: runType === RUN_TYPE.cmdPalette ? 1 : 0,
			};
			await this._db.add({ id: command.id, date, ...counts });
		}
	}

	private saveCurrentVersionNumber() {
		const currentVersion = this.manifest.version;
		const knownVersion = this.settings.viewCommandTracker.version;
		if (knownVersion) {
			if (currentVersion !== knownVersion) {
				this.settings.viewCommandTracker.version = currentVersion;
				this.saveSettings();
				new ConfirmReloadModal(this.app).open();
			}
		} else {
			this.settings.viewCommandTracker.version = currentVersion;
			this.saveSettings();
		}
	}
}
