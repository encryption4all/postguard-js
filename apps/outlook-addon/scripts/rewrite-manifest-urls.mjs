// Rewrite the dev origin out of the manifest that ships, and refuse to emit one
// that still points at it. Called from the CopyWebpackPlugin transform in
// webpack.config.js for production builds only; a development build keeps the
// localhost URLs on purpose. It lives in its own module so the two guards below
// can be tested without a webpack run.
//
// The rewrite was a bare `.replace()` whose result nothing checked, so a
// no-match shipped a production manifest whose `SourceLocation`, `IconUrl`,
// `HighResolutionIconUrl` and every `<bt:Url>` still resolved to
// `https://localhost:3000/`, through a pipeline green from end to end (#257).
// `pnpm build` exited 0, `office-addin-manifest validate` approved it because a
// localhost URL is valid HTTPS, and `scopeAppDomains()`'s `missing` check saw
// nothing either: manifest.xml lists the production origin as its own
// `<AppDomain>` entry independently of the localhost one, so nothing was missing
// and the unrewritten localhost entry was dropped as unused. The release job
// attaches that manifest to the release for admins to sideload and bakes it into
// the published image.
//
// Both guards are needed; neither subsumes the other:
//
// - The replacement count catches a total no-match. Asserting instead that the
//   output no longer contains `urlDev` cannot, because a global replace already
//   removes every occurrence of its own pattern, so that assertion never fires.
// - The leftover check catches a partial rewrite. `urlDev` carries a trailing
//   slash, so an entry written as the bare origin `https://localhost:3000` is
//   not matched by the replace and would survive a rewrite that reported plenty
//   of replacements.
export function rewriteManifestUrls(xml, urlDev, urlProd) {
  let replacements = 0;
  const rewritten = xml.replace(new RegExp(urlDev, "g"), () => {
    replacements += 1;
    return urlProd;
  });

  if (replacements === 0) {
    throw new Error(
      `manifest.xml contains no occurrence of ${urlDev}, so the rewrite to ${urlProd} changed ` +
        "nothing. A production manifest that kept the dev origin loads nothing in Outlook, and " +
        "no later gate objects: the build exits 0, the manifest validates, and scopeAppDomains() " +
        "drops the unrewritten entry as unused. Make urlDev in webpack.config.js match how the " +
        "dev origin is spelled in manifest.xml."
    );
  }

  const devOrigin = new URL(urlDev).origin;
  if (rewritten.includes(devOrigin)) {
    throw new Error(
      `The rewritten manifest.xml still contains ${devOrigin} after replacing ${replacements} ` +
        `occurrence(s) of ${urlDev}. Some URL spells the dev origin differently than urlDev in ` +
        "webpack.config.js does (the bare origin without a trailing slash, for instance), so the " +
        "replace skipped it. Every dev URL in manifest.xml has to share one spelling."
    );
  }

  return rewritten;
}
