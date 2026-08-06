type KeyEncapsulationOptions = Record<string, string>

type SecretKey = Uint8Array

export interface EncapsulationResult {
  encapsulation: () => Uint8Array

  options: () => KeyEncapsulationOptions

  key: () => SecretKey
}

export interface KeyEncapsulationService {
  encapsulate: (options: KeyEncapsulationOptions) => Promise<EncapsulationResult>

  decapsulate: (encapsulation: Uint8Array, options: Record<string, string>) => Promise<Uint8Array>
}
