# Basic VT Terminal Emulator Changelog

## `1.0.0`

- Breaking change: Upgrade to Angular 12, Typescript 4, and Corejs 3 to match Desktop libraries in Zowe v2. This app may no longer work in the Zowe v1 Desktop, and v2 should be used instead.
- Enhancement: The app now contains a manifest file so that it can be installed with `zwe components install`

## `0.11.0`

- Added ability to save connection preferences on a per-user level via the floppy disk save icon
- Removed dependency upon rxjs-compat, to clean up code and reduce package size.
