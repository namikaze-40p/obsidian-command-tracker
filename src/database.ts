import { IDBPDatabase, deleteDB, openDB } from "idb";

export interface IHotkey {
    uid?: number,
    id?: string,
    date?: number,
    hotkeyCount?: number,
    cmdPaletteCount?: number,
}

const STORE_NAME = 'command-history';

export class CommandTrackerDatabase {
	private _appId: string
	private _db: IDBPDatabase<IHotkey>;

	private get databaseName(): string {
		return `${this._appId}-CommandTracker`;
	}

	constructor(appId: string) {
		this._appId = appId;
	}

	async open(): Promise<void> {
		this._db = await openDB(this.databaseName, 1, {
			upgrade(db) {
				const store = db.createObjectStore(STORE_NAME, {
					keyPath: 'uid',
					autoIncrement: true,
				});
				store.createIndex('id', 'id');
				store.createIndex('date', 'date');
			},
			blocking(_, __, event) {
				(event.target as IDBDatabase).close();
			},
		});
	}

	close(): void {
		this._db.close();
	}

	async deleteDatabase(): Promise<void> {
		await deleteDB(this.databaseName);
	}

	async getAll(): Promise<IHotkey[]> {
		return await this._db.getAll(STORE_NAME);
	}

	async add(value: IHotkey): Promise<void> {
		const { id, date, hotkeyCount, cmdPaletteCount } = value;
		await this._db.add(STORE_NAME, { id, date, hotkeyCount, cmdPaletteCount });
	}

	async update(uid: number, value: IHotkey): Promise<void> {
		const tx = this._db.transaction(STORE_NAME, 'readwrite');
		const keyRangeValue = IDBKeyRange.only(uid);
		const cursor = await tx.store.openCursor(keyRangeValue);
		if (cursor) {
			await cursor.update({ ...cursor.value, ...value });
		}
		await tx.done;
	}

	async deleteAllRecords(): Promise<void> {
		await this._db.clear(STORE_NAME);
	}

	async deleteExceededRecords(uid: number): Promise<void> {
		const tx = this._db.transaction(STORE_NAME, 'readwrite');
		const keyRangeValue = IDBKeyRange.upperBound(uid);
		let cursor = await tx.store.openCursor(keyRangeValue);
		while (cursor) {
			await cursor.delete();
			cursor = await cursor.continue();
		}
		await tx.done;
	}

	async deleteOverdueRecords(date: number): Promise<void> {
		const tx = this._db.transaction(STORE_NAME, 'readwrite');
		const keyRangeValue = IDBKeyRange.upperBound(date);
		let cursor = await tx.store.index('date').openCursor(keyRangeValue);
		while (cursor) {
			await cursor.delete();
			cursor = await cursor.continue();
		}
		await tx.done;
	}

	async searchSameDateAndId(date: number, id: string): Promise<IHotkey[]> {
		const tx = this._db.transaction(STORE_NAME, 'readonly');
		const keyRangeDate = IDBKeyRange.only(date);
		let cursor = await tx.store.index('date').openCursor(keyRangeDate);
		const items: IHotkey[] = [];
		while (cursor) {
			items.push(cursor.value);
			cursor = await cursor.continue();
		}
		await tx.done;
		return items.filter(item => item.id === id);
	}
}
