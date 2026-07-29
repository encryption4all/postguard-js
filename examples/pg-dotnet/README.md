# pg-dotnet: PostGuard .NET example

Example .NET console app demonstrating how to use the [postguard-dotnet](https://github.com/encryption4all/postguard-dotnet) SDK for the **Informatierijk notificeren** use case.

## What it does

1. **Encrypt & Upload**: encrypts sample files for a citizen (exact email) and an organisation (email domain), uploads to Cryptify, and returns a UUID for custom distribution.
2. **Encrypt & Deliver**: same as above, but also sends an email notification to the recipient via Cryptify.

## Prerequisites

- .NET 10.0+ SDK. The project targets `net8.0;net10.0`, and an SDK cannot build a
  target framework newer than itself, so the .NET 8 SDK fails on the `net10.0` target.
  The .NET 10 SDK builds both, since it ships the net8.0 reference assemblies.
- A PostGuard API key

## Run

Store your API key with [user-secrets](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets) (recommended for local dev — kept outside the repo):

```bash
dotnet user-secrets set "PG_API_KEY" "PG-your-key-here"
dotnet run
```

Or pass it via environment variable:

```bash
export PG_API_KEY="PG-your-key-here"
dotnet run
```

Override the default URLs (via user-secrets or env vars) if needed:

| Variable          | Description                                | Default                                                                         |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `PG_PKG_URL`      | PostGuard PKG server URL                   | `https://pkg.staging.postguard.eu`                                              |
| `PG_CRYPTIFY_URL` | Cryptify file-sharing URL                  | `https://storage.staging.postguard.eu`                                          |
| `PG_DOWNLOAD_URL` | PostGuard website used in `/download` URLs | `https://staging.postguard.eu` on staging Cryptify, else `https://postguard.eu` |

## Staging Cryptify does not send email

The default `PG_CRYPTIFY_URL` is `storage.staging.postguard.eu` — the staging
deployment. It **does not actually deliver notification emails**, so you can
exercise the full upload + notify flow without spamming real inboxes while you
integrate the SDK.

What this means for the example:

- The upload itself works. You get back a real UUID and download URL.
- Flow 2 ("Encrypt & Deliver") returns success, but no email is sent to the
  recipient. You can open the printed download URL yourself to verify the
  decrypt flow end-to-end.
- Point `PG_CRYPTIFY_URL` at the production Cryptify host to exercise real
  email delivery.

## How it works

```csharp
var pg = new PostGuard(new PostGuardConfig
{
    PkgUrl = "https://pkg.staging.postguard.eu",
    CryptifyUrl = "https://storage.staging.postguard.eu"
});

// Encrypt returns a lazy Sealed builder. Note the name: `sealed` is a C#
// keyword, so it cannot be an identifier — Program.cs uses sealed1/sealed2.
var sealedFiles = pg.Encrypt(new EncryptInput
{
    Files = [new PgFile("report.txt", stream)],
    Recipients = [
        pg.Recipient.Email("citizen@example.com"),
        pg.Recipient.EmailDomain("info@org.nl")
    ],
    Sign = pg.Sign.ApiKey(apiKey)
});

// Silent upload (no Cryptify-sent emails). Returns UUID for custom distribution.
var silentResult = await sealedFiles.UploadAsync();

// Or upload + have Cryptify email the recipients (and optionally the sender).
var notifiedResult = await sealedFiles.UploadAsync(new UploadOptions
{
    Notify = new NotifyOptions
    {
        Recipients = true,
        Sender = true,
        Message = "Your documents",
        Language = "EN"
    }
});
```
