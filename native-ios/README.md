# RadarScout Native iOS

This is the parallel Swift-first iOS client for RadarScout. It intentionally does
not depend on Expo, React Native, CocoaPods, or EAS.

## Goals

- SwiftUI app shell with Apple-native navigation.
- MapKit-only driving experience.
- CoreLocation-backed driving mode.
- Typed radar feed, alert engine, and service boundaries.
- Room for Creative Studio assets through Xcode asset catalogs and Swift tokens.

## Local Build

```bash
pnpm run native-ios:build
pnpm run native-ios:test
```

## Runtime Configuration

The app reads optional Supabase values from Info.plist keys:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

If those are missing, the driving screen uses local sample radar data so the
native shell remains buildable and demoable without secrets.

`pnpm run native-ios:build` and `pnpm run native-ios:test` generate
`native-ios/Config/NativeLocal.xcconfig` from `.env` or `.env.submit` before
invoking Xcode. That generated file is gitignored.

## Supabase Smoke Test

```bash
pnpm run native-ios:smoke:supabase
```

The smoke script calls `get_nearby_radars_v2` around Union Square/SF and prints
only sanitized counts, source/type summaries, and sample metadata. It does not
print Supabase credentials.
