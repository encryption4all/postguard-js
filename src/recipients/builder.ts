/** Fluent builder for creating a recipient with attribute constraints. */
export class RecipientBuilder {
  readonly email: string;
  /** @internal */
  readonly _baseType: 'email' | 'emailDomain';
  /** @internal */
  readonly _extras: { t: string; v: string }[] = [];

  /** @internal */
  constructor(email: string, baseType: 'email' | 'emailDomain') {
    this.email = email;
    this._baseType = baseType;
  }

  /** Add an extra attribute the recipient must prove to decrypt. */
  extraAttribute(type: string, value: string): this {
    this._extras.push({ t: type, v: value });
    return this;
  }
}
