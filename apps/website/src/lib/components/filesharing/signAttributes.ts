import type { AttrConItem } from '@e4a/pg-js'

/**
 * Yivi attributes the sender may disclose when signing a PostGuard file
 * share. The PKG prepends the mandatory email attribute automatically.
 *
 * The first entry is an optional name disjunction — the sender may prove
 * their name from any one of four credentials, or skip entirely:
 *
 *   - `pbdf.gemeente.personalData.fullname` (Dutch municipality), OR
 *   - `pbdf.pbdf.passport.{firstName,lastName}`, OR
 *   - `pbdf.pbdf.idcard.{firstName,lastName}`, OR
 *   - `pbdf.pbdf.drivinglicence.{firstName,lastName}`.
 *
 * The leading `[]` alternative makes the whole group optional per Yivi
 * convention — senders without any of these credentials can still send.
 */
export const SIGN_ATTRIBUTES: AttrConItem[] = [
    [
        [],
        [{ t: 'pbdf.gemeente.personalData.fullname' }],
        [
            { t: 'pbdf.pbdf.passport.firstName' },
            { t: 'pbdf.pbdf.passport.lastName' },
        ],
        [
            { t: 'pbdf.pbdf.idcard.firstName' },
            { t: 'pbdf.pbdf.idcard.lastName' },
        ],
        [
            { t: 'pbdf.pbdf.drivinglicence.firstName' },
            { t: 'pbdf.pbdf.drivinglicence.lastName' },
        ],
    ],
    { t: 'pbdf.sidn-pbdf.mobilenumber.mobilenumber', optional: true },
    { t: 'pbdf.gemeente.personalData.dateofbirth', optional: true },
]
