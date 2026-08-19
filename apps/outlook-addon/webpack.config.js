const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const pkg = require("./package.json");
require("dotenv").config();

const urlDev = "https://localhost:3000/";
const urlProd = process.env.ADDIN_PUBLIC_URL || "https://addin.postguard.eu/";

const requiredEnv = ["PKG_URL", "CRYPTIFY_URL", "POSTGUARD_WEBSITE_URL"];
const envDefaults = {
  PKG_URL: "https://staging.postguard.eu/pkg",
  CRYPTIFY_URL: "https://storage.staging.postguard.eu",
  POSTGUARD_WEBSITE_URL: "https://staging.postguard.eu",
};
// `requiredEnv` used to require nothing: it fell through to `envDefaults`, which
// point at staging, so `webpack --mode production` with no env emitted a
// production add-in wired to the staging PKG — i.e. real users' key requests
// going to a staging deployment. The defaults are genuinely useful for a dev
// build, so they are kept there and refused in production.
function resolveEnv(isProduction) {
  const resolved = {};
  const missing = [];
  for (const key of requiredEnv) {
    const value = process.env[key];
    if (value) {
      resolved[key] = value;
    } else if (isProduction) {
      missing.push(key);
    } else {
      resolved[key] = envDefaults[key];
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for a production build: ${missing.join(", ")}. ` +
        "The staging defaults are only applied to development builds. The production values " +
        "are the ARG defaults in apps/outlook-addon/Dockerfile, and the release job passes them " +
        "as build-args from .github/workflows/outlook-addon.yml's env block."
    );
  }
  return resolved;
}

const APP_DOMAIN = /^([ \t]*)<AppDomain>([^<]*)<\/AppDomain>[ \t]*\r?\n/gm;

// Scope the shipped manifest's AppDomains to the origins this build actually
// uses, and fail if one it needs is missing.
//
// The source manifest lists the production *and* staging origins so either can
// be built from it, and the `https://localhost:3000/` entry is rewritten to this
// build's own origin by the transform below. Together that meant the production
// manifest allowlisted `addin.staging.postguard.eu` and `staging.postguard.eu`,
// plus two spellings of its own origin. Admins sideload this file, so the
// allowlist should name only what the build serves and navigates to.
//
// The `missing` check is the point of doing this here rather than by hand:
// removing a required AppDomain breaks `displayDialogAsync` at send time, which
// no CI job can observe (nothing exercises Office.js), so the production build
// refuses instead.
function scopeAppDomains(xml, addinOrigin, websiteOrigin) {
  const allowed = [addinOrigin, websiteOrigin, "https://yivi.app"];
  const kept = new Set();
  const dropped = [];
  const deduplicated = [];
  const scoped = xml.replace(APP_DOMAIN, (line, indent, value) => {
    let origin;
    try {
      origin = new URL(value.trim()).origin;
    } catch {
      // Not something we can reason about as an origin — leave it exactly as
      // written rather than silently dropping what the author meant.
      return line;
    }
    if (!allowed.includes(origin)) {
      dropped.push(value.trim());
      return "";
    }
    // Office matches an AppDomain by domain, so a second spelling of an origin
    // already listed (the rewritten localhost entry keeps its trailing slash)
    // allowlists nothing further. Reported separately from `dropped`: this
    // origin IS used by the build, and logging it as dropped told anyone
    // debugging a send-time dialog failure the opposite.
    if (kept.has(origin)) {
      deduplicated.push(value.trim());
      return "";
    }
    kept.add(origin);
    return `${indent}<AppDomain>${origin}</AppDomain>\n`;
  });

  const missing = allowed.filter((origin) => !kept.has(origin));
  if (missing.length > 0) {
    throw new Error(
      `manifest.xml is missing an <AppDomain> this build requires: ${missing.join(", ")}. ` +
        "The OnMessageSend runtime opens the Yivi dialog cross-origin, so an absent " +
        "origin fails only at send time, in Outlook."
    );
  }
  if (dropped.length > 0) {
    console.log(`manifest.xml: dropped AppDomains not used by this build: ${dropped.join(", ")}`);
  }
  if (deduplicated.length > 0) {
    console.log(
      `manifest.xml: collapsed duplicate spellings of origins this build DOES use: ${deduplicated.join(", ")}`
    );
  }
  return scoped;
}

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  // `await import` rather than `require`: the helper is ESM so CI's existing
  // `scripts/**/*.mjs` lint and format globs cover it, and requiring ESM from
  // this CommonJS file needs node >=22.12 while `engines` only asks for >=22.
  const { rewriteManifestUrls } = await import("./scripts/rewrite-manifest-urls.mjs");
  const dev = options.mode === "development";
  const resolvedEnv = resolveEnv(!dev);
  const config = {
    devtool: dev ? "source-map" : false,
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      taskpane: ["./src/taskpane/taskpane.ts", "./src/taskpane/taskpane.html"],
      commands: "./src/commands/commands.ts",
      launchevent: "./src/launchevent/launchevent.ts",
      "yivi-dialog": ["./src/yivi-dialog/yivi-dialog.ts", "./src/yivi-dialog/yivi-dialog.html"],
      "read-dialog": ["./src/read-dialog/read-dialog.ts", "./src/read-dialog/read-dialog.html"],
    },
    output: {
      clean: true,
    },
    experiments: {
      asyncWebAssembly: true,
      syncWebAssembly: true,
    },
    resolve: {
      extensions: [".ts", ".html", ".js", ".mjs", ".wasm"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: { loader: "babel-loader" },
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: {
            loader: "html-loader",
            options: {
              // yivi.min.css is copied into dist/ by CopyWebpackPlugin
              // below — leave the <link href> untouched so the browser
              // resolves it at runtime from the same directory as the
              // HTML page.
              sources: {
                urlFilter: (_attribute, value) => !/(^|\/)yivi\.min\.css$/.test(value),
              },
            },
          },
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
          type: "asset/resource",
          generator: { filename: "assets/[name][ext][query]" },
        },
        {
          test: /\.wasm$/,
          type: "asset/resource",
          generator: { filename: "[name][ext]" },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.PKG_URL": JSON.stringify(resolvedEnv.PKG_URL),
        "process.env.CRYPTIFY_URL": JSON.stringify(resolvedEnv.CRYPTIFY_URL),
        "process.env.POSTGUARD_WEBSITE_URL": JSON.stringify(resolvedEnv.POSTGUARD_WEBSITE_URL),
        // The add-in's own public origin. Needed by launchevent.ts to
        // build the Yivi dialog URL — window.location.href is unreliable
        // there because New Outlook for Mac runs the launchevent JS
        // override (JSRuntime.Url) where window.location is an Office-
        // internal URL, not the add-in origin.
        "process.env.ADDIN_PUBLIC_URL": JSON.stringify(dev ? urlDev : urlProd),
        // Stamped into the X-PostGuard-Client-Version header so PKG /
        // Cryptify dashboards can attribute metrics per release. Sourced
        // from package.json, which release-please bumps on every release.
        "process.env.ADDIN_VERSION": JSON.stringify(pkg.version),
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
      new HtmlWebpackPlugin({
        filename: "launchevent.html",
        template: "./src/launchevent/launchevent.html",
        chunks: ["launchevent"],
      }),
      new HtmlWebpackPlugin({
        filename: "yivi-dialog.html",
        template: "./src/yivi-dialog/yivi-dialog.html",
        chunks: ["polyfill", "yivi-dialog"],
      }),
      new HtmlWebpackPlugin({
        filename: "read-dialog.html",
        template: "./src/read-dialog/read-dialog.html",
        chunks: ["polyfill", "read-dialog"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "assets/*", to: "assets/[name][ext][query]" },
          {
            from: "node_modules/@privacybydesign/yivi-css/dist/yivi.min.css",
            to: "yivi.min.css",
          },
          {
            from: "manifest*.xml",
            to: "[name][ext]",
            transform(content) {
              if (dev) return content;
              const rewritten = rewriteManifestUrls(content.toString(), urlDev, urlProd);
              return scopeAppDomains(
                rewritten,
                new URL(urlProd).origin,
                new URL(resolvedEnv.POSTGUARD_WEBSITE_URL).origin
              );
            },
          },
        ],
      }),
    ],
    devServer: {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options:
          env.WEBPACK_BUILD || options.https !== undefined
            ? options.https
            : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  return config;
};
