import type { Locator, Page } from '@playwright/test';

export interface AvailabilityGroupOptions {
  displayName: string;
  host: string;
  osUsername: string;
  osPassword: string;
  agName: string;
  sqlUsername: string;
  sqlPassword: string;
}

// "Add Inventory Item" wizard, Application > Microsoft SQL Server (Always On availability group, failover cluster instance).
// Evidence: workspace/phase4/mssql-ag-add-learning.md. The form inputs are located by their `name` attribute among the
// visible inputs (the wizard keeps hidden forms for other platforms with the same names).
export interface FailoverClusterOptions {
  displayName: string;
  host: string;
  osUsername: string;
  osPassword: string;
  instanceName: string;
  sqlUsername: string;
  sqlPassword: string;
}

export type AvailabilityGroupField = keyof AvailabilityGroupOptions;

// The `name` attribute of every input of the Options step. `username` and `password` occur twice on the form: index 0 is the OS
// credential and index 1 the SQL credential.
export type FormInput = 'name' | 'type' | 'host' | 'username' | 'password' | 'availabilityGroupName' | 'instanceName';

export class AddInventoryItemPage {
  readonly title: Locator;
  readonly typeField: Locator;

  private readonly applicationTile: Locator;
  private readonly nextButton: Locator;
  private readonly finishButton: Locator;
  private readonly displayNameField: Locator;
  private readonly hostField: Locator;
  private readonly usernameFields: Locator;
  private readonly passwordFields: Locator;
  private readonly agNameField: Locator;
  private readonly instanceNameField: Locator;
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByText('Add Inventory Item');
    this.applicationTile = page.getByText('Application', { exact: true });
    this.nextButton = page.getByText('Next', { exact: true }).filter({ visible: true });
    this.finishButton = page.getByRole('button', { name: 'Finish' });
    this.typeField = page.locator('input[name="type"]:visible');
    this.displayNameField = page.locator('input[name="name"]:visible');
    this.hostField = page.locator('input[name="host"]:visible');
    // On the Always On form the first username/password pair is the OS credential and the second is the SQL credential.
    this.usernameFields = page.locator('input[name="username"]:visible');
    this.passwordFields = page.locator('input[name="password"]:visible');
    this.agNameField = page.locator('input[name="availabilityGroupName"]:visible');
    this.instanceNameField = page.locator('input[name="instanceName"]:visible');
  }

  // The radio of one platform tile of the Platform step (Virtual, SaaS, File Share, Physical, Application, Cloud Storage, Storage Devices).
  // Observed 2026-10-14: the tile is an <input role="radio"> followed by a <label for=...>; the input has no accessible name, so
  // getByRole('radio', { name }) never matches. The state (checked, enabled) is on the input, found through its label text.
  platformRadio(name: string): Locator {
    return this.page.locator(`xpath=//label[normalize-space(.)='${name}']/preceding-sibling::input[@role='radio']`);
  }

  async chooseApplication(): Promise<void> {
    await this.applicationTile.click();
  }

  async next(): Promise<void> {
    await this.nextButton.click();
    await this.hostField.waitFor();
  }

  // The Type list opens by clicking the (read-only) Type field; each choice is listed by its full text.
  async chooseType(typeName: string): Promise<void> {
    await this.typeField.click();
    await this.page.getByText(typeName, { exact: true }).filter({ visible: true }).click();
  }

  async fillFailoverCluster(options: FailoverClusterOptions): Promise<void> {
    await this.type(this.displayNameField, options.displayName);
    await this.type(this.hostField, options.host);
    await this.type(this.usernameFields.first(), options.osUsername);
    await this.type(this.passwordFields.first(), options.osPassword);
    await this.type(this.instanceNameField, options.instanceName);
    await this.type(this.usernameFields.last(), options.sqlUsername);
    await this.type(this.passwordFields.last(), options.sqlPassword);
  }

  // `omit` leaves the named fields untouched, for the negative cases that need a field missing.
  // A standalone instance has the same form as a failover cluster instance (Instance name and two credential pairs).
  async fillInstance(options: FailoverClusterOptions): Promise<void> {
    await this.fillFailoverCluster(options);
  }

  async fillAvailabilityGroup(options: AvailabilityGroupOptions, omit: AvailabilityGroupField[] = []): Promise<void> {
    const order: AvailabilityGroupField[] = ['displayName', 'host', 'osUsername', 'osPassword', 'agName', 'sqlUsername', 'sqlPassword'];
    for (const key of order) {
      if (omit.includes(key)) continue;
      await this.type(this.field(key), options[key]);
    }
  }

  // The input of one Always On form field.
  field(key: AvailabilityGroupField): Locator {
    switch (key) {
      case 'displayName': return this.displayNameField;
      case 'host': return this.hostField;
      case 'osUsername': return this.usernameFields.first();
      case 'osPassword': return this.passwordFields.first();
      case 'agName': return this.agNameField;
      case 'sqlUsername': return this.usernameFields.last();
      case 'sqlPassword': return this.passwordFields.last();
    }
  }

  // A message the wizard shows when the Director rejects the entry (for example a duplicate).
  message(text: RegExp): Locator {
    return this.page.getByText(text).filter({ visible: true });
  }

  // The form controls (including the username combos) take their value from real key input and a blur, as a user types it.
  // Typing at full speed dropped the first characters of passwords (and fill() set no value at all), so keys are
  // sent with a short delay.
  private async type(field: Locator, value: string): Promise<void> {
    await field.click();
    await field.pressSequentially(value, { delay: 80 });
    await field.press('Tab');
  }

  // Any input of the Options step among the visible inputs (the wizard keeps hidden forms with the same names).
  input(name: FormInput, index = 0): Locator {
    return this.page.locator(`input[name="${name}"]:visible`).nth(index);
  }

  // Types into one input the way a user does (see type() above: real key input, then Tab).
  async enter(name: FormInput, value: string, index = 0): Promise<void> {
    await this.type(this.input(name, index), value);
  }

  async finish(): Promise<void> {
    await this.finishButton.click();
  }
}
