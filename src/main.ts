import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { around } from 'monkey-around'
import { App, Platform, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { CustomApp, CommandPalettePluginInstance, Command, PluginInstance } from './types';
import { CommandTrackerDatabase } from './database';
import { CommandTrackerView, VIEW_TYPE_COMMAND_TRACKER } from './view';

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

		this.app.workspace.onLayoutReady(() => {
			this._db = new CommandTrackerDatabase((this.app as CustomApp).appId);
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
	}

	onunload() {
		if (this._uninstallWrapper.executeCommand) {
			this._uninstallWrapper.executeCommand();
			this._uninstallWrapper.executeCommand = undefined;
		}
		if (this._uninstallWrapper.onChooseItem) {
			this._uninstallWrapper.onChooseItem();
			this._uninstallWrapper.onChooseItem = undefined;
		}
		if (Platform.isDesktopApp && this.settings.isProtectData) {
			this._db.close();
		} else {
			this._db.delete();
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
		if (this.settings.stopTracing) {
			return;
		}
		await this.deleteRecords();
		await this.registerRecord(command, runType);
	}

	private async deleteRecords(): Promise<void> {
		const records = await this._db.commands.toArray();
		if (records.length > MAXIMUM_RECORDS) {
			const referenceUid = records.length - MAXIMUM_RECORDS + (records[0].uid ?? 0);
			await this._db.commands.where('uid').below(referenceUid).delete();
		}
		const referenceDate = parseInt(dayjs().subtract(RETENTION_PERIOD, 'd').format('YYYYMMDD'), 10);
		await this._db.commands.where('date').below(referenceDate).delete();
	}

	private async registerRecord(command: Command, runType: RunType): Promise<void> {
		const date = dayjs().format('YYYY/MM/DD');
		const usedCommands = await this._db.commands.where('date').equals(date).and(({ id }) => id === command.id).toArray();
		const usedCommand = usedCommands.length ? usedCommands[0] : null;
		if (usedCommand) {
			const { uid = 0, hotkeyCount = 0, cmdPaletteCount = 0 } = usedCommand;
			if (runType === RUN_TYPE.hotkey) {
				this._db.commands.update(uid, { hotkeyCount: hotkeyCount + 1 });
			} else {
				this._db.commands.update(uid, { cmdPaletteCount: cmdPaletteCount + 1 });
			}
		} else {
			const counts = {
				hotkeyCount: runType === RUN_TYPE.hotkey ? 1 : 0,
				cmdPaletteCount: runType === RUN_TYPE.cmdPalette ? 1 : 0,
			};
			this._db.commands.add({ id: command.id, date, ...counts });
		}
	}
}
