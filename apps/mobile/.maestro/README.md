# Maestro flows

UI checks for the mobile app, run against a simulator or device with
[Maestro](https://maestro.mobile.dev/).

| Flow | Checks |
|---|---|
| `feed_discovery.yaml` | A site URL adds the feed it links to; a page without a feed is rejected (BRUSHUP #18) |
| `keyword_highlight.yaml` | Articles matching a notification keyword get the strip, the chip and the title marker; removing the keyword removes them |

`subflows/` holds shared steps and is not run on its own.

## Running

The app must be installed and signed in to a test account.

```sh
cd apps/mobile
# Dev client: start Metro (npx expo start --dev-client) and point the flows at it
maestro test .maestro/ -e METRO_URL=http://localhost:8081
# Installed release or preview build: launch it as is
maestro test .maestro/
```

## Notes

- The flows change the account and undo it at the end: `feed_discovery`
  adds and deletes https://github.blog/feed/, `keyword_highlight` adds and
  removes a keyword. If a flow stops halfway, remove those by hand.
- `keyword_highlight` needs an article with "iPhone" in its title (the test
  account follows iPhone Mania).
- `subflows/confirm_delete.yaml` taps the alert's Delete button by screen
  position, because text selectors also match the Delete buttons of the feed
  rows behind the alert. It was tuned on a 6.3" iPhone (iOS 27); adjust the
  point if it misses on other sizes.
- The failing-feed indicator (#4) and the offline banner (#8) need a feed
  that keeps failing or a failing network, which these flows cannot set up.
