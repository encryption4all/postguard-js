import { browser } from '$app/environment'

let postalMimePromise

function loadPostalMime() {
    if (!browser)
        return Promise.reject(new Error('postal-mime is browser-only'))
    if (!postalMimePromise) {
        postalMimePromise = import('postal-mime')
    }
    return postalMimePromise
}

// parse email using postalmime
export async function parseMail(unparsed) {
    const module = await loadPostalMime()
    const parser = new module.default()
    return parser.parse(unparsed)
}

// download email/attachment
export function downloadAttachment(outFile, fileType, fileName) {
    const downFile = new Blob([outFile], { type: fileType })
    let a = document.createElement('a'),
        url = URL.createObjectURL(downFile)

    a.href = url
    a.download = fileName
    document.body.appendChild(a)

    a.click()
    URL.revokeObjectURL(url)
    a.remove()
}
