# OMFIT WordPress incident — 2026-09-08

Confirmed on the live site https://omfit.com.vn/; these affected WordPress files are not present in this repository.

## Evidence and remediation

- Public homepage initially contained four script tags loading `cdn.quickdelivr.com/mpackage.js`.
- Active plugin `arctic-relay-plus/arctic-relay-plus.php` (Arctic Relay Plus 6.3.0) implements `FrontendScriptInjector`, injecting this URL into `wp_head` and `wp_footer`. It explicitly skips logged-in administrators, admin pages, REST, cron and AJAX requests.
- Deactivated that plugin via authenticated WordPress REST API. Fresh public homepage and contact page then contained two remaining script tags.
- Read the active theme's `header.php` and `footer.php`: each contained one literal script tag loading the same URL.
- Backed up both files locally, verified SHA-256 against those backups before writing, and removed only that exact tag from each file.
- Purged LiteSpeed cache and flushed WordPress object cache.
- Deleted rogue WordPress administrators `sys_maint` (IDs 8, 9 and 10). IDs 9 and 10 were recreated automatically after earlier deletions.
- Located the persistence mechanism at the end of `wp-content/themes/hadkaur/functions.php`: hardcoded credentials, a `quick_create()` function, and an `init` hook that recreated `sys_maint` as an administrator.
- Removed that exact persistence block after verifying the live file SHA-256 against the preserved backup. The repaired `functions.php` hash is `2de29706b0dcab0ef0d20a5a9a31bea17243588aa5298355b60b9b79087584bb`.
- Deleted the final recreated administrator after repairing the theme and verified that it did not return.
- Moved the now-empty `wp-content/plugins/arctic-relay-plus` directory to the cPanel trash.
- Temporary administrator-only diagnostic/repair snippets were removed via DELETE after use. Subsequent listing retained IDs 10–14 as inactive; the diagnostic route returned 404.

## Verification

Five public HTTP requests (homepage, contact, news, about, and a cache-busted homepage) returned 200 with zero occurrences of `quickdelivr`, `claritydelivr`, or `mpackage.js` in HTML. This checks those specific indicators, not every possible infection or browser behavior.

The WordPress administration email was changed and verified as `minhducnguyen2512@hotmail.com`. The remaining administrators are `admin` (ID 1) and `quantri` (ID 2).

Theme file hashes after repair:

- header.php: `d85c42eae3cc545a9a39bf0c3c82caf96c93a9ee56c6c3c79460d0231d65fb7e`
- footer.php: `e248bd27ae23f3998a3f6b39ed026e6226d4cc9ce878aeb3a38ef35a1f892314`

Backups and verification evidence are in the ignored, local-only directory `security-incident-20260908.local/`. Do not publish those files or reactivate the injector plugin.

## Still unresolved

- Initial compromise vector and persistence have not been established. Full hosting filesystem, other sites on the account, scheduled tasks, administrator accounts and access logs need examination; compare WordPress/plugin/theme files against trusted originals.
- The injector plugin remains installed but inactive; its source is preserved as evidence. Remove/quarantine it as part of the full hosting cleanup.
- Google Security Issues category and sample URLs have not been provided. Google has not been asked to review the site, and warning removal has not been verified.
- A separate local JSON-LD hardening concern was observed: inline schema uses JSON_UNESCAPED_SLASHES without JSON_HEX_TAG. It was not established as the incident's cause and was not changed during this targeted live repair.

After completing the wider cleanup, request a security review using Search Console's Security Issues report: https://support.google.com/webmasters/answer/9044101?hl=en
