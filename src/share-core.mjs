// Pure share-URL builder (only headless bit of the share module): swap whatever hash the
// current URL already carries for the new scene hash, so the copied link is absolute and
// self-contained regardless of what junk was in the address bar before. Node --test'able.

/**
 * Build the absolute share URL by replacing the current URL's hash with `hash`.
 * @param {string} href current location.href (may already have a #fragment)
 * @param {string} hash the new fragment, with or without a leading '#'
 * @returns {string}
 */
export function shareUrl(href, hash) {
  const base = href.split('#')[0]
  return base + (hash.startsWith('#') ? hash : '#' + hash)
}
