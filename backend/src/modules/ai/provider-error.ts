export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'PROVIDER_DISABLED'
      | 'PROVIDER_UNAVAILABLE'
      | 'MISSING_API_KEY'
      | 'TIMEOUT'
      | 'QUOTA_EXCEEDED'
      | 'INVALID_RESPONSE'
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
