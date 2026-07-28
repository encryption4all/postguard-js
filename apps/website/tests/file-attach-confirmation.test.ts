import { expect, test } from '@playwright/test'

// Regression test for the file-attach step UX (issue
// encryption4all/postguard-website#291).
//
// In the July 2026 user test a participant added a second file after one was
// already attached, because it was not clear a file was already there or that
// the step was complete. The fix makes the attached-file state explicit with a
// status confirmation ("N file(s) attached") and demotes "Add more files" to a
// secondary affordance below the file list, so it no longer reads as the
// primary next action.

// Dropzone appends a hidden <input type="file"> to the body; driving it fires
// the same `change` handler a real file pick would.
const hiddenFileInput = 'input.dz-hidden-input'

async function attachFile(page: import('@playwright/test').Page, name: string) {
    await page.locator(hiddenFileInput).setInputFiles({
        name,
        mimeType: 'text/plain',
        buffer: Buffer.from('hello world'),
    })
}

test.beforeEach(async ({ page }) => {
    await page.goto('/fileshare/')
    await expect(page.locator(hiddenFileInput)).toBeAttached()
})

test('attaching a file shows an explicit "file attached" confirmation', async ({
    page,
}) => {
    await attachFile(page, 'secret.txt')

    // The confirmation is a live status region so screenreaders announce it.
    const confirmation = page.locator('.files-attached')
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toHaveAttribute('role', 'status')
    await expect(confirmation).toContainText('1 file attached')

    // The single attached file is listed.
    await expect(page.locator('#previews .dz-preview')).toHaveCount(1)
    await expect(page.locator('#previews .file-title')).toHaveText('secret.txt')
})

test('the confirmation count reflects the number of attached files', async ({
    page,
}) => {
    await attachFile(page, 'one.txt')
    await attachFile(page, 'two.txt')

    await expect(page.locator('.files-attached')).toContainText(
        '2 files attached'
    )
    await expect(page.locator('#previews .dz-preview')).toHaveCount(2)
})

test('"Add more files" is a secondary affordance below the file list', async ({
    page,
}) => {
    await attachFile(page, 'secret.txt')

    // The chip itself is non-interactive markup; Dropzone wires the click on
    // the container, so it renders as a static chip rather than a button.
    const addMore = page.locator('.add-more-chip-container .chip')
    await expect(addMore).toBeVisible()
    await expect(addMore).toContainText('Add more files')
    // Demoted to the small chip variant (was previously a large chip).
    await expect(addMore).toHaveClass(/chip-sm/)

    // It sits after the confirmation and the file list in DOM order, so it no
    // longer competes with the file previews for the user's attention.
    const confirmationBox = await page.locator('.files-attached').boundingBox()
    const addMoreBox = await addMore.boundingBox()
    expect(confirmationBox).not.toBeNull()
    expect(addMoreBox).not.toBeNull()
    expect(addMoreBox!.y).toBeGreaterThan(confirmationBox!.y)
})
