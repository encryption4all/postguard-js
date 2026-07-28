import { describe, it, expect } from 'vitest'
import {
    isUnsignedSender,
    isWeakSenderIdentity,
    verifiedAttributesFor,
} from './verifiedAttributes'
import type { FriendlySender } from '@e4a/pg-js'

const isEmail = (type: string) => type.endsWith('.email.email')

const sender = (attrs: { type: string; value?: string }[]): FriendlySender => ({
    email: attrs.find((a) => isEmail(a.type))?.value ?? null,
    attributes: attrs,
    raw: {
        public: {
            con: attrs
                .filter((a) => isEmail(a.type))
                .map((a) => ({ t: a.type, v: a.value })),
        },
        private: {
            con: attrs
                .filter((a) => !isEmail(a.type))
                .map((a) => ({ t: a.type, v: a.value })),
        },
    },
})

describe('verifiedAttributesFor', () => {
    it('returns an empty list when sender is null or undefined', () => {
        expect(verifiedAttributesFor(null)).toEqual([])
        expect(verifiedAttributesFor(undefined)).toEqual([])
    })

    it('returns each non-email attribute with its type and value', () => {
        const result = verifiedAttributesFor(
            sender([
                { type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' },
                {
                    type: 'pbdf.gemeente.personalData.fullname',
                    value: 'R.A. Hensen',
                },
                {
                    type: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                    value: '+31630222348',
                },
                {
                    type: 'pbdf.gemeente.personalData.dateofbirth',
                    value: '27-05-1996',
                },
            ])
        )
        expect(result).toEqual([
            {
                type: 'pbdf.gemeente.personalData.fullname',
                value: 'R.A. Hensen',
            },
            {
                type: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                value: '+31630222348',
            },
            {
                type: 'pbdf.gemeente.personalData.dateofbirth',
                value: '27-05-1996',
            },
        ])
    })

    it('keeps a non-email attribute whose type merely contains "email"', () => {
        // The email filter matches the `.email.email` suffix, not any
        // substring — an unrelated attribute is not silently dropped.
        const result = verifiedAttributesFor(
            sender([
                { type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' },
                {
                    type: 'pbdf.pbdf.emailverification.status',
                    value: 'verified',
                },
            ])
        )
        expect(result.map((r) => r.type)).toEqual([
            'pbdf.pbdf.emailverification.status',
        ])
    })

    it('drops attributes whose value is missing or empty', () => {
        const result = verifiedAttributesFor(
            sender([
                { type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' },
                {
                    type: 'pbdf.gemeente.personalData.fullname',
                    value: 'R.A. Hensen',
                },
                {
                    type: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber',
                    value: undefined,
                },
            ])
        )
        expect(result.map((r) => r.type)).toEqual([
            'pbdf.gemeente.personalData.fullname',
        ])
    })

    it('returns an empty list when the sender only disclosed email', () => {
        const result = verifiedAttributesFor(
            sender([{ type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' }])
        )
        expect(result).toEqual([])
    })
})

describe('isWeakSenderIdentity', () => {
    it('does not treat a missing sender as email-only weak', () => {
        // An unsigned file has no email to caveat, so the email-only
        // warning copy does not apply — flagging it would be inaccurate.
        expect(isWeakSenderIdentity(null)).toBe(false)
        expect(isWeakSenderIdentity(undefined)).toBe(false)
    })

    it('does not treat a sender with no verified email as email-only weak', () => {
        // No email and nothing else disclosed: there is no email claim to
        // warn about, so this is not the email-only case.
        expect(isWeakSenderIdentity(sender([]))).toBe(false)
    })

    it('treats an email-only sender as weak', () => {
        expect(
            isWeakSenderIdentity(
                sender([
                    {
                        type: 'pbdf.sidn-pbdf.email.email',
                        value: 'a@b.com',
                    },
                ])
            )
        ).toBe(true)
    })

    it('treats a sender with any verified non-email attribute as strong', () => {
        expect(
            isWeakSenderIdentity(
                sender([
                    {
                        type: 'pbdf.sidn-pbdf.email.email',
                        value: 'a@b.com',
                    },
                    {
                        type: 'pbdf.gemeente.personalData.fullname',
                        value: 'R.A. Hensen',
                    },
                ])
            )
        ).toBe(false)
    })

    it('ignores non-email attributes whose value is empty', () => {
        // An attribute type without a value carries no signal — it must
        // not flip the gate from "weak" to "strong".
        expect(
            isWeakSenderIdentity(
                sender([
                    {
                        type: 'pbdf.sidn-pbdf.email.email',
                        value: 'a@b.com',
                    },
                    {
                        type: 'pbdf.gemeente.personalData.fullname',
                        value: undefined,
                    },
                ])
            )
        ).toBe(true)
    })
})

describe('isUnsignedSender', () => {
    it('treats a missing sender as unsigned', () => {
        expect(isUnsignedSender(null)).toBe(true)
        expect(isUnsignedSender(undefined)).toBe(true)
    })

    it('treats a sender with no verified email as unsigned', () => {
        expect(isUnsignedSender(sender([]))).toBe(true)
    })

    it('does not treat an email-only sender as unsigned', () => {
        expect(
            isUnsignedSender(
                sender([
                    { type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' },
                ])
            )
        ).toBe(false)
    })

    it('does not treat a fully verified sender as unsigned', () => {
        expect(
            isUnsignedSender(
                sender([
                    { type: 'pbdf.sidn-pbdf.email.email', value: 'a@b.com' },
                    {
                        type: 'pbdf.gemeente.personalData.fullname',
                        value: 'R.A. Hensen',
                    },
                ])
            )
        ).toBe(false)
    })
})
