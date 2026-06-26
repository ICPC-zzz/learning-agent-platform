/**
 * Model Gateway — unified entry point for model operations.
 *
 * - Credential Vault (encrypt/decrypt)
 * - SSRF Guard (base URL validation)
 * - Auth Headers (bearer, api-key, basic, custom, none)
 * - Provider Adapter (connection test)
 * - Model Profile Resolver
 */

export { encryptCredential, decryptCredential, getCredentialVaultStatus, maskSecret, generateEncryptionKeyBase64 } from "./credential-vault.ts";
export type { EncryptResult, DecryptResult, CredentialVaultStatus } from "./credential-vault.ts";

export { validateBaseUrl, SSRF_DEFAULTS } from "./ssrf-guard.ts";
export type { SsrfOptions } from "./ssrf-guard.ts";

export { buildAuthHeaders, getCredentialFieldsForAuthMode, describeAuthHeaders } from "./auth-headers.ts";
export type { ModelAuthMode, CredentialFieldDefinition, AuthHeaderInput, AuthHeaderResult } from "./auth-headers.ts";

export { testOpenAiCompatibleConnection } from "./openai-compatible-adapter.ts";
export type { AdapterConfig, ConnectionTestResult } from "./openai-compatible-adapter.ts";

export { generateStructured } from "./structured-generation.ts";
export type {
  StructuredGenerationConfig,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "./structured-generation.ts";
