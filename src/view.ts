import dayjs from 'dayjs';
import { CellClickedEvent, ColDef, ColGroupDef, GridApi, ITextFilterParams, TextMatcherParams, createGrid } from 'ag-grid-community';

import { ItemView, Notice, Platform, Setting, WorkspaceLeaf } from 'obsidian';
import { CommandTrackerDatabase, IHotkey } from './database';
import { CustomApp, Command, ViewType } from './types';
import { DATE_FORMAT, Settings, VIEW_TYPE } from './settings';

export const VIEW_TYPE_COMMAND_TRACKER = 'command-tracker-view';

const compareName = (a: { [key: string]: string | number }, b: { [key: string]: string | number }): number => {
	if (!a || typeof a.command !== 'string' || !b || typeof b.command !== 'string') {
		return 0;
	}
	return a.command.localeCompare(b.command);
};

const compareDate = (selectedDate: Date, cellValue: number): number => {
	if (cellValue == null) {
		return -1;
	}
	const cellDate = dayjs(`${cellValue}`, 'YYYYMMDD');
	const referDate = dayjs(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
	if (cellDate.isBefore(referDate)) {
		return -1;
	} else if (cellDate.isAfter(referDate)) {
		return 1;
	}
	return 0;
}

export class CommandTrackerView extends ItemView {
	private _settings: Settings;
	private _db: CommandTrackerDatabase;
	private _commandMap = new Map<string, Command & { keys: string[] }>();
	private _records: IHotkey[] = [];
	private _viewType: ViewType = VIEW_TYPE.perCmd;
	private _gridApi: GridApi;

	constructor(leaf: WorkspaceLeaf, settings: Settings) {
		super(leaf);

		this._settings = settings;
		const { appId, commands, hotkeyManager = { bakedIds: [], bakedHotkeys: [] } } = this.app as CustomApp;
		this._db = new CommandTrackerDatabase(appId);
		Object.entries(commands.commands).forEach(([key, val]) => this._commandMap.set(key, { ...val, keys: [] }));
		this.associateHotkeys(hotkeyManager.bakedIds, hotkeyManager.bakedHotkeys);
	}

	getViewType(): string {
		return VIEW_TYPE_COMMAND_TRACKER;
	}

	getDisplayText(): string {
		return 'Command Tracker';
	}

	async onOpen(): Promise<void> {
		this.containerEl.empty();
		this.containerEl.addClass('ct-view-content');

		await this._db.open();
		this._records = await this._db.getAll();
		this.generateHeader();
		const tableEl = this.containerEl.createDiv('ag-theme-quartz ct-table');
		const gridOptions = {
			onCellClicked: (event: CellClickedEvent) => {
				if (navigator.clipboard) {
					const value = event.column.getColDef().field === 'date' ? this.formatDate({ value: event.value }) : event.value;
					if (value) {
						navigator.clipboard.writeText(value).then(() => new Notice('Copied the cell value.'));
					}
				}
			}
		}
		this._gridApi = createGrid(tableEl, gridOptions);

		if (this._settings.viewType === VIEW_TYPE.perCmd) {
			this.displayRecordsPerCommand();
		} else {
			this.displayRecordsPerCommandAndDaily();
		}
	}

	async onClose(): Promise<void> {
		this._db.close();
	}

	private associateHotkeys(bakedIds: string[], bakedHotkeys: { key: string, modifiers: string }[]): void {
		bakedIds.forEach((bakedId: string, idx: number) => {
			const command = this._commandMap.get(bakedId);
			if (command) {
				const { modifiers: orgModifiers, key: orgKey } = bakedHotkeys[idx];
				const modifiers = this.replaceModifiers(orgModifiers);
				const key = this.replaceKey(orgKey);
				const delimiter = Platform.isMacOS || Platform.isIosApp ? '' : ' + '
				const hotkey = (`${modifiers ? modifiers + ',' : ''}`).replaceAll(',', delimiter) + key;
				command.keys = [...command.keys, hotkey];
			}
		});
	}

	private replaceModifiers(modifiers: string): string {
		if (Platform.isMacOS || Platform.isIosApp) {
			return modifiers.replace('Meta', '⌘').replace('Mod', '⌘').replace('Shift', '⇧').replace('Ctrl', '^').replace('Alt', '⌥');
		} else {
			return modifiers.replace('Meta', 'Win').replace('Mod', 'Ctrl');
		}
	}

	private replaceKey(key: string): string {
		const replacedKey = key.replace(' ', 'Space').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→');
		return`${replacedKey.charAt(0).toUpperCase()}${replacedKey.slice(1)}`;
	}

	private generateHeader(): void {
		this.containerEl.createDiv('ct-view-header', el => {
			el.createDiv('ct-first-line', div => {
				div.createEl('h6', { text: 'Command Tracker View' });
				div.createEl('button', '', button => {
					button.setText('Reload');
					button.onclick = async (): Promise<void> => {
						this._records = await this._db.getAll();
						this._viewType === VIEW_TYPE.perCmd ? this.displayRecordsPerCommand() : this.displayRecordsPerCommandAndDaily();
					};
				});
			});

			new Setting(el.createDiv('ct-view-selector'))
				.setName(`Specify view type`)
				.addDropdown(dropdown => dropdown
					.addOptions({ [VIEW_TYPE.perCmd]: VIEW_TYPE.perCmd, [VIEW_TYPE.perCmdAndDay]: VIEW_TYPE.perCmdAndDay })
					.setValue(this._settings.viewType)
					.onChange((value: ViewType) => {
						this._viewType = value;
						value === VIEW_TYPE.perCmd ? this.displayRecordsPerCommand() : this.displayRecordsPerCommandAndDaily();
					}),
				);
		});
	}

	private displayRecordsPerCommand(): void {
		this._gridApi.setGridOption('columnDefs', this.generateColumns());
		this._gridApi.setGridOption('rowData', this.generateRecordsPerCommand());
	}

	private displayRecordsPerCommandAndDaily(): void {
		this._gridApi.setGridOption('columnDefs', this.generateColumns());
		this._gridApi.setGridOption('rowData', this.generateRecordsPerCommandAndDaily());
	}

	private generateColumns(): (ColDef | ColGroupDef)[] {
		return [
			{ 
				headerName: 'ID',
				field: 'id',
				hide: true,
			}, 
			{ 
				headerName: 'Command',
				field: 'command',
				filter: true,
				floatingFilter: true,
				filterParams: {
					buttons: ['clear'],
				} as ITextFilterParams,
				flex: 5,
				minWidth: 320,
				suppressMovable: true,
			}, 
			{ 
				headerName: 'Hotkeys',
				field: 'hotkeys',
				filter: true,
				floatingFilter: true,
				filterParams: {
					buttons: ['clear'],
				} as ITextFilterParams,
				flex: 2,
				minWidth: 120,
				suppressMovable: true,
			},
			{ 
				headerName: this._viewType === VIEW_TYPE.perCmd ? 'Date of last use' : 'Date of use',
				field: 'date',
				filter: Platform.isDesktopApp ? 'agDateColumnFilter' : 'agTextColumnFilter',
				floatingFilter: true,
				filterParams: {
					buttons: ['clear'],
					...(Platform.isDesktopApp
						? {
							comparator: compareDate,
						}
						: {
							filterPlaceholder: this._settings.dateFormat,
							textMatcher: this.isMatchDate.bind(this),
						}),
				} as ITextFilterParams,
				valueFormatter: this.formatDate.bind(this),
				flex: 2,
				minWidth: 160,
				suppressMovable: true,
			},
			{
				headerName: 'Count',
				groupId: 'count',
				openByDefault: this._gridApi.getColumnGroupState().find(colGrp => colGrp.groupId === 'count')?.open ?? true,
				children: [
					{ 
						headerName: 'Total',
						field: 'totalCount',
						filter: 'agNumberColumnFilter',
						floatingFilter: true,
						filterParams: {
							buttons: ['clear'],
						} as ITextFilterParams,
						width: 110,
						valueGetter: p => (p.data.hotkeyCount ?? 0) + (p.data.cmdPaletteCount ?? 0),
						suppressMovable: true,
					},
					{ 
						headerName: 'Hotkeys',
						field: 'hotkeyCount',
						filter: 'agNumberColumnFilter',
						floatingFilter: true,
						filterParams: {
							buttons: ['clear'],
						} as ITextFilterParams,
						width: 110,
						columnGroupShow: 'open',
						suppressMovable: true,
					},
					{
						headerName: 'Command palette',
						field: 'cmdPaletteCount',
						filter: 'agNumberColumnFilter',
						floatingFilter: true,
						filterParams: {
							buttons: ['clear'],
						} as ITextFilterParams,
						width: 170,
						columnGroupShow: 'open',
						suppressMovable: true,
					},
				],
			},
		];
	}

	private generateRecordsPerCommand(): { [key: string]: string | number | undefined }[] {
		return this._records.reduce((acc, cur) => {
			const row = acc.find(row => row.id === cur.id);
			if (!row) {
				return acc;
			}
			if (row.date) {
				if (cur.date) {
					row.date = dayjs(cur.date, 'YYYY/MM/DD').isAfter(dayjs(row.date, 'YYYY/MM/DD')) ? cur.date : row.date;
				}
				row.hotkeyCount = (row.hotkeyCount as number) + (cur.hotkeyCount ?? 0);
				row.cmdPaletteCount = (row.cmdPaletteCount as number) + (cur.cmdPaletteCount ?? 0);
			} else {
				if (cur.date) {
					row.date = cur.date;
				}
				row.hotkeyCount = cur.hotkeyCount ?? 0;
				row.cmdPaletteCount = cur.cmdPaletteCount ?? 0;
			}
			return acc;
		}, this.generateBaseRecords());
	}

	private generateRecordsPerCommandAndDaily(): { [key: string]: string | number | undefined }[] {
		return this._records.reduce((acc, cur) => {
			const row = acc.find(row => row.id === cur.id);
			if (!row) {
				return acc;
			}
			if (row.date) {
				const { id, command, hotkeys } = row;
				const newRow = { id, command, hotkeys, date: cur.date, hotkeyCount: cur.hotkeyCount ?? 0, cmdPaletteCount: cur.cmdPaletteCount ?? 0 };
				return [...acc, newRow];
			} else {
				if (cur.date) {
					row.date = cur.date;
				}
				row.hotkeyCount = cur.hotkeyCount ?? 0;
				row.cmdPaletteCount = cur.cmdPaletteCount ?? 0;
				return acc;
			}
		}, this.generateBaseRecords());
	}

	private generateBaseRecords(): { [key: string]: string | number | undefined }[] {
		const rows = [...this._commandMap.values()].map(command => {
			return {
				id: command?.id ?? '',
				command: command?.name ?? '',
				hotkeys: command?.keys.join(' or '),
				date: undefined,
				hotkeyCount: 0,
				cmdPaletteCount: 0,
			} as { [key: string]: string | number | undefined };
		});
		return rows.sort(compareName);
	}

	private isMatchDate({ filterOption, value, filterText }: TextMatcherParams): boolean {
		if (filterText == null) {
			return false;
		}
		const date = this.formatDate({ value });
		switch (filterOption) {
			case 'contains':
				return date.indexOf(filterText) >= 0;
			case 'notContains':
				return date.indexOf(filterText) < 0;
			case 'equals':
				return date === filterText;
			case 'notEqual':
				return date !== filterText;
			case 'startsWith':
				return date.indexOf(filterText) === 0;
			case 'endsWith': {
				const index = date.lastIndexOf(filterText);
				return index >= 0 && index === (date.length - filterText.length);
			}
			default:
				return false;
		}
	}
	private formatDate(p: { value: number }): string {
		const date = p.value ? `${p.value}` : '';
		switch (this._settings.dateFormat) {
			case DATE_FORMAT.mmddyyyy:
				return date ? `${date.slice(4, 6)}/${date.slice(6)}/${date.slice(0, 4)}` : '';
			case DATE_FORMAT.ddmmyyyy:
				return date ? `${date.slice(6)}/${date.slice(4, 6)}/${date.slice(0, 4)}` : '';
			case DATE_FORMAT.yyyymmdd:
			default:
				return date ? `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6)}` : '';
		}
	}
}
