type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type EmbeddingMetadata = { readonly [key: string]: JsonValue };

export interface EmbeddingInput {
  id?: string;
  content: string;
  metadata?: EmbeddingMetadata;
}

export type EmbeddingVector = readonly number[];

export interface EmbeddingRequest {
  input: EmbeddingInput | readonly EmbeddingInput[];
  model?: string;
  metadata?: EmbeddingMetadata;
}

export interface EmbeddingResponse {
  vectors: readonly EmbeddingVector[];
  model?: string;
  metadata?: EmbeddingMetadata;
}

export interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}
