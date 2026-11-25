/** A problem with what the admin typed; carries a user-facing message. */
export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryValidationError";
  }
}
