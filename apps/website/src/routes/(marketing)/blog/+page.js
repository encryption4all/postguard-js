/**
 * @typedef {{ slug: string, title: string, description: string, date: string, image?: string }} BlogPost
 */

export async function load() {
    const postFiles = import.meta.glob('/src/content/blog/*.svx', {
        eager: true,
    })

    /** @type {BlogPost[]} */
    const posts = Object.entries(postFiles)
        .map(([path, module]) => {
            const { metadata } =
                /** @type {{ metadata: Record<string, any> }} */ (module)
            return /** @type {BlogPost} */ ({
                slug: /** @type {string} */ (path.split('/').pop()).replace(
                    '.svx',
                    ''
                ),
                ...metadata,
            })
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return { posts }
}
