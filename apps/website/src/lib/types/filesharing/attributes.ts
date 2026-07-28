import type { AttributeCon } from '@e4a/pg-js'
export type { AttributeCon }

export enum EncryptionState {
    FileSelection = 1,
    Sign,
    Encrypting,
    Error,
    Done,
}

export enum Lang {
    EN = 'EN',
    NL = 'NL',
}

export type EncryptState = {
    recipients: { email: string; extra: AttributeCon }[]
    sender: string
    message: string
    files: File[]
    percentages: number[]
    done: boolean[]
    encryptionState: EncryptionState
    abort: AbortController
    selfAborted: boolean
    serverError: boolean
    encryptStartTime: number
    /** Cryptify upload UUID, captured via `onUploadInit` as soon as the
     *  server allocates one. Used by the staging email-preview modal. */
    uploadUuid?: string
}

export type AttType =
    | 'pbdf.sidn-pbdf.mobilenumber.mobilenumber'
    | 'pbdf.gemeente.personalData.fullname'
    | 'pbdf.gemeente.personalData.dateofbirth'

export type CryptFileInputProps = {
    lang: Lang
    onFile: (f: FileList) => void
    multiple: boolean
    required: boolean
}
