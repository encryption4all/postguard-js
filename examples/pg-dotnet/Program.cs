using E4A.PostGuard;
using E4A.PostGuard.Models;
using Microsoft.Extensions.Configuration;

var config = new ConfigurationBuilder()
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

var pkgUrl = config["PG_PKG_URL"] ?? "https://pkg.staging.postguard.eu";
var cryptifyUrl = config["PG_CRYPTIFY_URL"] ?? "https://storage.staging.postguard.eu";
var apiKey = config["PG_API_KEY"]
    ?? throw new Exception("Set PG_API_KEY via `dotnet user-secrets set PG_API_KEY \"<key>\"` or as an environment variable.");

// Heuristic: the staging Cryptify (hostname contains "staging") does NOT
// actually deliver notification emails — this keeps real inboxes clean
// while you wire up the SDK. Detect it from the URL so the example can
// be honest about what will and won't happen.
var isCryptifyStaging = Uri.TryCreate(cryptifyUrl, UriKind.Absolute, out var cryptifyUri)
    && cryptifyUri.Host.Contains("staging", StringComparison.OrdinalIgnoreCase);

// Base URL of the PostGuard website that handles /download?uuid=…. Files
// uploaded to the staging Cryptify are only retrievable via the staging
// website, so the default tracks isCryptifyStaging; override with the env
// var or user-secret if your deployment differs.
var downloadBaseUrl = config["PG_DOWNLOAD_URL"]
    ?? (isCryptifyStaging ? "https://staging.postguard.eu" : "https://postguard.eu");

var pg = new PostGuard(new PostGuardConfig
{
    PkgUrl = pkgUrl,
    CryptifyUrl = cryptifyUrl
});

if (isCryptifyStaging)
{
    Console.WriteLine($"[staging] Using staging Cryptify ({cryptifyUrl}).");
    Console.WriteLine("[staging] Notification emails are NOT delivered on staging, so");
    Console.WriteLine("[staging] recipients/senders won't actually receive anything.");
    Console.WriteLine("[staging] The upload itself works and the download URLs below are");
    Console.WriteLine("[staging] real — use them to verify the decrypt flow yourself.");
    Console.WriteLine();
}

// Create sample files
var files = new List<PgFile>
{
    new("report.txt", new MemoryStream("This is a sample report for PostGuard encryption testing."u8.ToArray())),
    new("notes.txt", new MemoryStream("These are confidential notes.\nOnly the intended recipient should be able to read this."u8.ToArray()))
};

// ── Flow 1: Silent upload (returns UUID for custom distribution) ──

Console.WriteLine("=== Flow 1: Encrypt and Upload ===");
Console.WriteLine("Encrypting and uploading silently...");

var sealed1 = pg.Encrypt(new EncryptInput
{
    Files = files,
    Recipients =
    [
        pg.Recipient.Email("citizen@example.com"),
        pg.Recipient.EmailDomain("info@org.nl")
    ],
    Sign = pg.Sign.ApiKey(apiKey)
});

// No UploadOptions → no Cryptify-sent emails. The caller distributes the
// download link (or the recipients use the PostGuard browser/Outlook/
// Thunderbird add-ons to decrypt directly).
var result1 = await sealed1.UploadAsync();
Console.WriteLine($"Upload complete! UUID: {result1.Uuid}");
Console.WriteLine($"Download URL: {downloadBaseUrl}/download?uuid={result1.Uuid}");
Console.WriteLine();

// ── Flow 2: Upload with Cryptify-sent recipient emails ──

Console.WriteLine("=== Flow 2: Encrypt and Deliver ===");
Console.WriteLine("Encrypting and delivering via Cryptify email...");

// Reset streams for reuse
foreach (var f in files) f.Content.Position = 0;

var sealed2 = pg.Encrypt(new EncryptInput
{
    Files = files,
    Recipients =
    [
        pg.Recipient.Email("bob@example.com")
    ],
    Sign = pg.Sign.ApiKey(apiKey)
});

var result2 = await sealed2.UploadAsync(new UploadOptions
{
    Notify = new NotifyOptions
    {
        // Both opt-in: Cryptify emails the recipient with a download link
        // and the sender with a confirmation receipt.
        Recipients = true,
        Sender = true,
        Message = "Your documents are attached. Please use PostGuard to decrypt.",
        Language = "EN"
    }
});
Console.WriteLine($"Upload complete! UUID: {result2.Uuid}");
Console.WriteLine($"Download URL: {downloadBaseUrl}/download?uuid={result2.Uuid}");
if (isCryptifyStaging)
{
    Console.WriteLine("[staging] No email was sent to bob@example.com — open the download");
    Console.WriteLine("[staging] URL above yourself to verify the decrypt flow end-to-end.");
}
else
{
    Console.WriteLine("Recipients will receive an email from noreply@postguard.eu");
}
