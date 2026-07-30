# @e4a/pg-js public API surface

Generated from the rolled-up `dist/index.d.mts` by `pnpm api:update`. Do not edit
by hand.

This file is the package compatibility contract. Every change to it is a change
consumers can see, so read the diff before approving: a removal or a changed
signature needs a major changeset, a new export needs at least a minor one.
`pnpm api:check` fails when the file drifts from the build; `pnpm api:gate`
compares it against the base branch and checks the pending changeset.

Private class members are omitted and members are sorted by name, so neither
reordering nor internal state shows up here.

```ts
export {
  type ApiKeySign,
  type AttrConItem,
  type AttrDiscon,
  type AttrReq,
  type AttributeCon,
  type BuildMimeOptions,
  type CreateEnvelopeOptions,
  type DecryptDataResult,
  type DecryptFileResult,
  type DecryptInput,
  type DecryptResult,
  DecryptionError,
  type DetectPostGuardInput,
  type EncryptInput,
  type EnvelopeResult,
  type EnvelopeTier,
  type ExtractCiphertextOptions,
  type FileState,
  type FriendlySender,
  IdentityMismatchError,
  type InspectResult,
  NetworkError,
  type OpenInput,
  Opened,
  PG_MAX_ATTACHMENT_SIZE,
  PG_MAX_URL_FRAGMENT_SIZE,
  POSTGUARD_ENCRYPTED_FILENAME,
  type ParsedAttachment,
  type ParsedMessage,
  PostGuard,
  type PostGuardConfig,
  PostGuardError,
  type PrepareSignOptions,
  type PreparedSign,
  type Recipient,
  RecipientBuilder,
  type RetryEvent,
  type RetryOptions,
  Sealed,
  type SessionCallback,
  type SessionRequest,
  type SessionSign,
  type SignMethod,
  type SigningKeys,
  type UploadOptions,
  type UploadResult,
  UploadSessionExpiredError,
  YiviNotInstalledError,
  YiviSessionError,
  type YiviSign,
  bodyFromMime,
  buildMime,
  createEnvelope,
  createZipReadable,
  detectPostGuard,
  extractArmoredCiphertext,
  extractCiphertext,
  extractUploadUuid,
  injectMimeHeaders,
  isMultipart,
  looksLikeArmoredPostGuard,
  parseDecryptedMime,
  readMimeHeader,
  resumeUpload,
};

interface ApiKeySign {
    apiKey: string;
    type: 'apiKey';
}

type AttrConItem = AttrReq | AttrDiscon;

type AttrDiscon = AttrReq[][];

type AttrReq = {
    t: string;
    v?: string;
    optional?: boolean;
};

type AttributeCon = {
    t: string;
    v?: string;
}[];

interface BuildMimeOptions {
    attachments?: Array<{
        name: string;
        type: string;
        data: ArrayBuffer;
    }>;
    cc?: string[];
    date?: Date;
    from: string;
    htmlBody?: string;
    inReplyTo?: string;
    plainTextBody?: string;
    references?: string;
    subject: string;
    to: string[];
}

interface CreateEnvelopeOptions {
    from: string;
    notify?: UploadOptions['notify'];
    onUploadInit?: UploadOptions['onUploadInit'];
    sealed: Sealed;
    senderAttributes?: string[];
    unencryptedMessage?: string;
    uploadToCryptify?: boolean;
    websiteUrl?: string;
}

interface DecryptDataResult {
    plaintext: Uint8Array;
    sender: FriendlySender | null;
}

interface DecryptFileResult {
    blob: Blob;
    download: () => void;
    files: Array<{
        name: string;
        blob: Blob;
    }>;
    sender: FriendlySender | null;
}

interface DecryptInput {
    element?: string;
    enableCache?: boolean;
    onDownloadProgress?: (percentage: number | undefined) => void;
    recipient?: string;
    session?: SessionCallback;
}

type DecryptResult = DecryptFileResult | DecryptDataResult;

declare class DecryptionError extends PostGuardError {
    constructor(message: string, options?: ErrorOptions);
}

interface DetectPostGuardInput {
    attachmentNames?: string[];
    htmlBody?: string;
}

interface EmailAttributes {
    domain: string;
    email: string;
}

declare class EmailHelpers {
    constructor(config: PostGuardConfig);
    buildMime(options: BuildMimeOptions): Uint8Array;
    createEnvelope(options: CreateEnvelopeOptions): Promise<EnvelopeResult>;
    extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null;
    injectMimeHeaders(mime: string, headersToInject: Record<string, string>, headersToRemove?: string[]): string;
}

interface EncryptInput {
    data?: Uint8Array | ReadableStream<Uint8Array>;
    files?: File[] | FileList;
    onProgress?: (percentage: number) => void;
    recipients: Recipient[];
    sign: SignMethod;
    signal?: AbortSignal;
    signingKeys?: SigningKeys;
}

interface EnvelopeResult {
    attachment: File | null;
    htmlBody: string;
    plainTextBody: string;
    subject: string;
    tier: EnvelopeTier;
    uploadUuid: string | null;
}

type EnvelopeTier = 'tier1' | 'tier2' | 'tier3';

interface ExtractCiphertextOptions {
    attachments?: Array<{
        name: string;
        data: ArrayBuffer;
    }>;
    htmlBody?: string;
}

interface FileState {
    prevToken?: string;
    recoveryToken: string;
    token: string;
    uuid: string;
}

interface FriendlySender {
    attributes: {
        type: string;
        value?: string;
    }[];
    email: string | null;
    raw: SenderIdentity;
}

declare class IdentityMismatchError extends DecryptionError {
    constructor(options?: ErrorOptions);
}

interface InspectResult {
    policies: Map<string, any>;
    recipients: string[];
    sender: FriendlySender | null;
}

declare class NetworkError extends PostGuardError {
    constructor(message: string, status: number, body: string);
    readonly body: string;
    readonly status: number;
}

type OpenInput = {
    uuid: string;
    signal?: AbortSignal;
} | {
    data: Uint8Array | ReadableStream<Uint8Array>;
};

declare class Opened {
    constructor(config: PostGuardConfig, options: OpenInput);
    decrypt(opts: DecryptInput): Promise<DecryptFileResult | DecryptDataResult>;
    inspect(): Promise<InspectResult>;
}

declare const PG_MAX_ATTACHMENT_SIZE: number;

declare const PG_MAX_URL_FRAGMENT_SIZE = 100000;

declare const POSTGUARD_ENCRYPTED_FILENAME = "postguard.encrypted";

interface ParsedAttachment {
    data: Uint8Array;
    name: string;
    type: string;
}

interface ParsedMessage {
    attachments: ParsedAttachment[];
    htmlBody: string | null;
    plainBody: string | null;
}

declare class PostGuard extends PostGuardBase {
    encrypt(options: EncryptInput): Sealed;
    open(options: OpenInput): Opened;
    prepareSign(opts: PrepareSignOptions): PreparedSign;
}

declare class PostGuardBase {
    constructor(config: PostGuardConfig);
    protected readonly config: PostGuardConfig;
    readonly email: EmailHelpers;
    protected readonly emailAttributes: EmailAttributes;
    readonly recipient: {
        email: (email: string) => RecipientBuilder;
        emailDomain: (email: string) => RecipientBuilder;
    };
    readonly sign: {
        apiKey: (apiKey: string) => ApiKeySign;
        yivi: (opts: {
            element: string;
            senderEmail?: string;
            attributes?: AttrConItem[];
            includeSender?: boolean;
        }) => YiviSign;
        session: (callback: SessionCallback, opts: {
            senderEmail: string;
        }) => SessionSign;
    };
}

interface PostGuardConfig {
    cryptifyUrl?: string;
    emailAttributes?: {
        email?: string;
        domain?: string;
    };
    headers?: HeadersInit;
    pkgUrl: string;
    retry?: RetryOptions;
    uploadChunkSize?: number;
}

declare class PostGuardError extends Error {
    constructor(message: string, options?: ErrorOptions);
}

interface PrepareSignOptions {
    attributes?: AttrConItem[];
    element: string;
    includeSender?: boolean;
    senderEmail?: string;
    signal?: AbortSignal;
}

interface PreparedSign {
    cancel(): void;
    keys: Promise<SigningKeys>;
    mobileUrl: Promise<string>;
}

type Recipient = RecipientBuilder;

declare class RecipientBuilder {
    constructor(email: string, baseType: 'email' | 'emailDomain');
    readonly _baseType: 'email' | 'emailDomain';
    readonly _extras: {
        t: string;
        v: string;
    }[];
    readonly email: string;
    extraAttribute(type: string, value: string): this;
}

interface RetryEvent {
    attempt: number;
    error: unknown;
    maxAttempts: number;
    nextDelayMs: number;
}

interface RetryOptions {
    chunkTimeoutMs?: number;
    downloadTimeoutMs?: number;
    finalizeTimeoutMs?: number;
    initialDelayMs?: number;
    maxAttempts?: number;
    maxDelayMs?: number;
    multiplier?: number;
    onRetry?: (info: RetryEvent) => void;
}

declare class Sealed {
    constructor(config: PostGuardConfig, options: EncryptInput);
    get canUpload(): boolean;
    get mode(): 'data' | 'files';
    toBytes(): Promise<Uint8Array>;
    upload(opts?: UploadOptions): Promise<UploadResult>;
}

interface SenderIdentity {
    private?: {
        con: {
            t: string;
            v?: string;
        }[];
    };
    public: {
        con: {
            t: string;
            v?: string;
        }[];
    };
}

type SessionCallback = (request: SessionRequest) => Promise<string>;

interface SessionRequest {
    con: {
        t: string;
        v?: string;
    }[];
    hints?: {
        t: string;
        v?: string;
    }[];
    senderId?: string;
    sort: 'Signing' | 'Decryption';
}

interface SessionSign {
    callback: SessionCallback;
    senderEmail: string;
    type: 'session';
}

type SignMethod = ApiKeySign | YiviSign | SessionSign;

interface SigningKeys {
    privSignKey?: unknown;
    pubSignKey: unknown;
    senderEmail?: string;
}

interface UploadOptions {
    notify?: {
        recipients?: boolean;
        sender?: boolean;
        message?: string;
        language?: 'EN' | 'NL';
    };
    onUploadInit?: (info: {
        uuid: string;
        recoveryToken: string;
    }) => void;
}

interface UploadResult {
    uuid: string;
}

declare class UploadSessionExpiredError extends NetworkError {
    constructor(uuid: string, reason: string, body: string);
    readonly reason: string;
    readonly uuid: string;
}

declare class YiviNotInstalledError extends PostGuardError {
    constructor();
}

declare class YiviSessionError extends PostGuardError {
    constructor(reason: string);
    get cancelled(): boolean;
    readonly reason: string;
}

interface YiviSign {
    attributes?: AttrConItem[];
    element: string;
    includeSender?: boolean;
    senderEmail?: string;
    type: 'yivi';
}

declare function bodyFromMime(rawMime: string): string;

declare function buildMime(input: BuildMimeOptions): Uint8Array;

declare function createEnvelope(options: CreateEnvelopeOptions): Promise<EnvelopeResult>;

declare function createZipReadable(files: File[]): Promise<ReadableStream>;

declare function detectPostGuard(input: DetectPostGuardInput): boolean;

declare function extractArmoredCiphertext(htmlOrText: string): string | null;

declare function extractCiphertext(options: ExtractCiphertextOptions): Uint8Array | null;

declare function extractUploadUuid(html: string): string | null;

declare function injectMimeHeaders(mime: string, headersToInject: Record<string, string>, headersToRemove?: string[]): string;

declare function isMultipart(rawMime: string): boolean;

declare function looksLikeArmoredPostGuard(htmlOrText: string): boolean;

declare function parseDecryptedMime(rawMime: string): ParsedMessage;

declare function readMimeHeader(rawMime: string, name: string): string | undefined;

declare function resumeUpload(cryptifyUrl: string, uuid: string, recoveryToken: string, signal?: AbortSignal, headers?: HeadersInit): Promise<{
    state: FileState;
    uploaded: number;
}>;
```
