import { expect, test } from '@playwright/test'

// The optional recipient attributes (date of birth, phone number) were unclear
// to senders in a user test: it wasn't obvious what requiring one does. A short
// explainer must sit above the add-attribute chips in the compose panel.

test('the compose panel explains the optional recipient attributes', async ({
    page,
}) => {
    await page.goto('/fileshare/')
    await expect(
        page.getByRole('textbox', { name: /email address/i })
    ).toBeVisible()

    const explainer = page.locator('.attributes-explainer')
    await expect(explainer).toBeVisible()
    await expect(explainer).toContainText(/prove more about themselves/i)

    // The explainer precedes the add-attribute chips (e.g. the date-of-birth
    // button) in document order, so it reads as an intro to them.
    const addButton = page.getByRole('button', { name: /date of birth/i })
    await expect(addButton).toBeVisible()
    const addButtonHandle = await addButton.elementHandle()
    if (!addButtonHandle) throw new Error('date-of-birth button not found')
    const explainerComesFirst = await explainer.evaluate(
        (el, btn) =>
            !!(
                el.compareDocumentPosition(btn) &
                Node.DOCUMENT_POSITION_FOLLOWING
            ),
        addButtonHandle
    )
    expect(explainerComesFirst).toBe(true)
})
