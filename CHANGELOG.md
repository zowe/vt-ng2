# Basic VT Terminal Emulator Changelog

## `1.0.0`
- This action making a CHANGELOG note via special syntax from the GitHub PR commit message, like it could automatically update CHANGELOG.md with the message. First job checks if PR body has changelog note or not if it's not there then it asked them to add it and second job is to check if changelog note has been added in changelog.md file or not. (#61)

- Breaking change: Upgrade to Angular 12, Typescript 4, and Corejs 3 to match Desktop libraries in Zowe v2. This app may no longer work in the Zowe v1 Desktop, and v2 should be used instead.
- Enhancement: The app now contains a manifest file so that it can be installed with `zwe components install`

## `0.11.0`

- Added ability to save connection preferences on a per-user level via the floppy disk save icon
- Removed dependency upon rxjs-compat, to clean up code and reduce package size.
