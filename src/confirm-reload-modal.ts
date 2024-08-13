import { App, Modal } from 'obsidian';

export class ConfirmReloadModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		this.modalEl.addClasses(['confirm-reload-modal', 'ct-modal']);

		const titleEl = this.contentEl.createEl('h4');
		titleEl.setText('"Command Tracker" plugin have been updated.');

		const messageEl = this.contentEl.createEl('span');
		messageEl.setText('You need to reload Obsidian to use the "Command Tracker" plugin. Would you like to reload now?');

		this.contentEl.createDiv('ct-buttons', el => {
			const cancelButton = el.createEl('button');
			cancelButton.setText('Later');
			cancelButton.addEventListener('click', () => {
				this.close();
			});

			const reloadButton = el.createEl('button');
			reloadButton.setText('Reload');
			reloadButton.addClass('mod-cta');
			reloadButton.addEventListener('click', () => {
				window.location.reload();
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
