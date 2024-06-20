import { App, ButtonComponent, Platform, PluginSettingTab, Setting } from 'obsidian';
import CommandTracker from './main';
import { CommandTrackerDatabase } from './database';
import { CustomApp } from './types';

const SETTING_TYPE = {
	viewCommandTracker: 'viewCommandTracker',
} as const;

export interface ViewCommandTrackerSettings {
	viewType: string;
	dateFormat: string;
	isProtectData: boolean;
	stopTracing: boolean;
}

export interface Settings {
	[SETTING_TYPE.viewCommandTracker]: ViewCommandTrackerSettings;
}

export const VIEW_TYPE: Record<string, string> = {
	perCmd: 'Count per command',
	perCmdAndDay: 'Count per command and day',
};

export const DATE_FORMAT: Record<string, string> = {
	yyyymmdd: 'yyyy/mm/dd',
	mmddyyyy: 'mm/dd/yyyy',
	ddmmyyyy: 'dd/mm/yyyy',
};

const VIEW_COMMAND_TRACKER_DEFAULT_SETTINGS = {
	viewType: VIEW_TYPE.perCmd,
	dateFormat: DATE_FORMAT.yyyymmdd,
	isProtectData: false,
	stopTracing: false,
} as const;

export const DEFAULT_SETTINGS: Settings = {
	[SETTING_TYPE.viewCommandTracker]: VIEW_COMMAND_TRACKER_DEFAULT_SETTINGS,
} as const;

const DELETION_CONFIRMATION_TEXT = 'Delete';

export class SettingTab extends PluginSettingTab {
	plugin: CommandTracker;
	private _deleteBtn: ButtonComponent;
	private _db: CommandTrackerDatabase;

	constructor(app: App, plugin: CommandTracker) {
		super(app, plugin);
		this.plugin = plugin;
		this._db = new CommandTrackerDatabase((this.app as CustomApp).appId);
		this._db.open();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2').setText('Command Tracker - Settings');
		containerEl.addClass('ct-settings');

		this.setForViewCommandTrackerCommand(containerEl);
	}

	private setForViewCommandTrackerCommand(containerEl: HTMLElement): void {
		const settingType = SETTING_TYPE.viewCommandTracker;
		const settings = this.plugin.settings[settingType];

		new Setting(containerEl)
			.setName(`Initial view type`)
			.setDesc(`Select the initial view type for the table.`)
			.addDropdown(item => item
				.addOptions(Object.values(VIEW_TYPE).reduce((obj, v) => (obj[v] = v, obj), {} as typeof VIEW_TYPE))
				.setValue(settings.viewType)
				.onChange(async value => {
					settings.viewType = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.viewType = DEFAULT_SETTINGS[settingType].viewType;
				this.addResetButton(settingEl, setDefaultValue);
			});

		new Setting(containerEl)
			.setName(`Date format`)
			.setDesc(`Select the date format for the cells.`)
			.addDropdown(item => item
				.addOptions(Object.values(DATE_FORMAT).reduce((obj, v) => (obj[v] = v, obj), {} as typeof DATE_FORMAT))
				.setValue(settings.dateFormat)
				.onChange(async value => {
					settings.dateFormat = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.dateFormat = DEFAULT_SETTINGS[settingType].dateFormat;
				this.addResetButton(settingEl, setDefaultValue);
			});
			
		new Setting(containerEl)
			.setName(`Stop tracking`)
			.setDesc(`When enabled, stop tracking and not write to DB. Data of before stop isn't deleted.`)
			.addToggle(toggle => toggle
				.setValue(settings.stopTracing)
				.onChange(async value => {
					settings.stopTracing = value;
					await this.plugin.saveData(this.plugin.settings);
				}),
			)
			.then(settingEl => {
				const setDefaultValue = () => settings.stopTracing = DEFAULT_SETTINGS[settingType].stopTracing;
				this.addResetButton(settingEl, setDefaultValue);
			});

		if (Platform.isDesktopApp) {
			new Setting(containerEl)
				.setName(`Protect data when plugin updated, disabled, or uninstall`)
				.setDesc(`When enabled, protect all data of “Command Tracker” when plugin updated, disabled, or uninstall.`)
				.addToggle(toggle => toggle
					.setValue(settings.isProtectData)
					.onChange(async value => {
						settings.isProtectData = value;
						await this.plugin.saveData(this.plugin.settings);
					}),
				)
				.then(settingEl => {
					const setDefaultValue = () => settings.isProtectData = DEFAULT_SETTINGS[settingType].isProtectData;
					this.addResetButton(settingEl, setDefaultValue);
				});
		}

		new Setting(containerEl)
			.setName('Delete all data')
			.setDesc('Delete all data of "Command Tracker". If you want to delete, type "Delete" in the text box and click the "Delete" button.')
			.addText(text => text
				.setPlaceholder('Delete')
				.onChange(value => {
					if (value === DELETION_CONFIRMATION_TEXT) {
						this._deleteBtn.setDisabled(false);
					} else {
						this._deleteBtn.setDisabled(true);
					}
				})
				.inputEl.addClass('ct-delete-input'),
			)
			.addButton(button => {
				this._deleteBtn = button;
				return button
					.setButtonText('Delete')
					.setDisabled(true)
					.onClick(async () => {
						await this._db.deleteAllRecords();
						this.display();
					});
				},
			);

		containerEl.createDiv('ct-delete-description', el => {
			el.createSpan('').setText('Data of “Command Tracker” is deleted in the following cases.');
			const ulEl = el.createEl('ul');
			{
				const LiEl = ulEl.createEl('li');
				LiEl.setText('All data is deleted in the following cases.');
				const childUlEl = LiEl.createEl('ul');
				childUlEl.createEl('li').setText('When the "Delete all data" operation in the settings.');
				childUlEl.createEl('li').setText('When this plugin is updated.');
				childUlEl.createEl('li').setText('When this plugin is disabled.');
				childUlEl.createEl('li').setText('When this plugin is uninstalled.');
			}
			{
				const LiEl = ulEl.createEl('li');
				LiEl.setText('Some data is deleted in the following cases.');
				const childUlEl = LiEl.createEl('ul');
				childUlEl.createEl('li').setText('When the number of records exceeds 2000 lines and a new record is written, the oldest record is deleted.');
				childUlEl.createEl('li').setText('When a new record is written, records exceeding 60 days from the date of use are deleted.');	
			}
		});
	}

	private addResetButton(settingEl: Setting, setDefaultValue: () => void, refreshView = true): void {
        settingEl
            .addExtraButton(button => button
				.setIcon('reset')
				.setTooltip('Reset to default')
				.onClick(async () => {
					setDefaultValue();
					await this.plugin.saveSettings();
					if (refreshView) {
						this.display();
					}
				}),
			);
	}
}
