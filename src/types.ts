import { App, Editor, MarkdownFileInfo, MarkdownView, Plugin } from 'obsidian'
import { VIEW_TYPE } from './settings';

export type CustomApp = App & {
	appId: string,
	commands: {
		app: App,
		commands: { [key: string]: Command },
		editorCommands: { [key: string]: Command },
		executeCommand: (command: Command, ev: Event) => boolean,
	},
	hotkeyManager?: {
		bakedIds: string[],
		bakedHotkeys: {
			key: string,
			modifiers: string,
		}[],
	},
	internalPlugins: {
		getEnabledPluginById: (pluginId: string) => PluginInstance,	
	},
};

export type Command = {
	id: string,
	name: string,
	icon?: string,
	hotkeys?: {
		key: string,
		modifiers: string[],
	},
	callback?: () => any,
	editorCallback?: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => any,
	checkCallback?: (checking: boolean, editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => boolean | void,
}

export type PluginInstance = CommandPalettePluginInstance;

type BasicPluginParams = {
	app: App,
	defaultOn: boolean,
	description: string,
	id: string,
	name: string,
	plugin: Plugin,
};

export type CommandPalettePluginInstance = BasicPluginParams & {
	modal: {
		onChooseItem: (command: Command, ev: Event) => void,
	},
};

export type ViewType = typeof VIEW_TYPE[keyof typeof VIEW_TYPE];
