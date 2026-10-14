import type { Locator, Page } from '@playwright/test';

export type EditField = 'displayName' | 'host' | 'osUsername' | 'osPassword' | 'agName' | 'sqlUsername' | 'sqlPassword';

// The Edit dialog of an Inventory item: the same form as Add Inventory Item (Type disabled, Display name editable),
// with Cancel and Save. Evidence: workspace/phase4/mssql-ag-lifecycle.md and mssql-ag-edit-negative-cases.md (live
// inspection on 2026-10-05). Locators follow the Add wizard's: `name` attribute among the visible inputs, buttons by text.
export class EditInventoryItemPage {
  readonly displayNameField: Locator;
  // Shown by Cancel when something was changed.
  readonly closePrompt: Locator;
  readonly closePromptDetail: Locator;

  private readonly saveButton: Locator;
  private readonly cancelButton: Locator;
  private readonly closeButton: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.displayNameField = page.locator('input[name="name"]:visible');
    this.closePrompt = page.getByText('Close the wizard?').filter({ visible: true });
    this.closePromptDetail = page.getByText('All changes will be lost.').filter({ visible: true });
    this.saveButton = page.getByText('Save', { exact: true }).filter({ visible: true });
    this.cancelButton = page.getByText('Cancel', { exact: true }).filter({ visible: true });
    this.closeButton = page.getByText('Close', { exact: true }).filter({ visible: true });
  }

  // The input of one form field. The OS credential pair comes first and the SQL pair second, as in the Add wizard.
  field(key: EditField): Locator {
    const visible = (name: string): Locator => this.page.locator(`input[name="${name}"]:visible`);
    switch (key) {
      case 'displayName': return this.displayNameField;
      case 'host': return visible('host');
      case 'osUsername': return visible('username').first();
      case 'osPassword': return visible('password').first();
      case 'agName': return visible('availabilityGroupName');
      case 'sqlUsername': return visible('username').last();
      case 'sqlPassword': return visible('password').last();
    }
  }

  // Replaces the value by typing, as in the Add wizard (fill() does not reach the form's value).
  async replace(key: EditField, value: string): Promise<void> {
    const field = this.field(key);
    await field.click();
    await field.press('Control+A');
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  async clear(key: EditField): Promise<void> {
    const field = this.field(key);
    await field.click();
    await field.press('Control+A');
    await field.press('Delete');
    await field.press('Tab');
  }

  async setDisplayName(value: string): Promise<void> {
    await this.replace('displayName', value);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  // Confirms the "Close the wizard? All changes will be lost." prompt.
  async confirmClose(): Promise<void> {
    await this.closeButton.click();
  }
}
