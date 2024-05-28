import Dexie from 'dexie';

export interface IHotkey {
    uid?: number,
    id?: string,
    date?: string,
    hotkeyCount?: number,
    cmdPaletteCount?: number,
}

export class CommandTrackerDatabase extends Dexie {
    commands!: Dexie.Table<IHotkey, number>;

    constructor (appId: string) {
        super(`${appId}-CommandTracker`);
        this.version(1).stores({
            commands: '++uid, id, date, hotkeyCount, cmdPaletteCount',
        });
    }
}
