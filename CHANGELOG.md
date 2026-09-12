# [1.0.0](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.3.2...v1.0.0) (2026-09-12)


* feat!: require a backend secret and add upload limits ([2175807](https://github.com/flayks/sanity-plugin-remote-files/commit/2175807dc32a033105c2f597de52d30345691a71))


### Bug Fixes

* preserve posters, order deletes and size the files grid ([8001ddf](https://github.com/flayks/sanity-plugin-remote-files/commit/8001ddf39bbc0149e703686b553249b93b587996))


### Features

* show file kind icons and play media from the field ([082ecf8](https://github.com/flayks/sanity-plugin-remote-files/commit/082ecf8db1e17a8cd6395f1b41b520936588f972))


### BREAKING CHANGES

* the R2 and S3 templates refuse to run without
REMOTE_FILES_SECRET, and enforce MAX_UPLOAD_MB and ALLOWED_CONTENT_TYPES.
The plugin now requires React 19 and Sanity 5 or 6.

## [0.3.2](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.3.1...v0.3.2) (2026-07-09)


### Bug Fixes

* only return format values if existing + uniformize file size ([78b9a8a](https://github.com/flayks/sanity-plugin-remote-files/commit/78b9a8af96d185ff3e3edc0daad83111e0b79213))

## [0.3.1](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.3.0...v0.3.1) (2026-07-09)

# [0.3.0](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.2.0...v0.3.0) (2026-07-08)


### Features

* add poster requirement option ([f28de48](https://github.com/flayks/sanity-plugin-remote-files/commit/f28de4869575300e01ccbe995ed433249b39b7b4))

# [0.2.0](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.1.0...v0.2.0) (2026-07-08)


### Bug Fixes

* don't add a prefix by default ([5825b46](https://github.com/flayks/sanity-plugin-remote-files/commit/5825b46ef931d6ee1b3c2948b7d8b8037241157e))


### Features

* add more metadata to files and rework relations data ([0155288](https://github.com/flayks/sanity-plugin-remote-files/commit/0155288fe715c7ecf42a2f82c58aa94adee497dd))
* add poster image for videos ([e45962e](https://github.com/flayks/sanity-plugin-remote-files/commit/e45962eebef8b6654fceab616d2d6c8c78c8679d))
* rework details layout ([400af79](https://github.com/flayks/sanity-plugin-remote-files/commit/400af795c05750434881b17842110500fb7926a4))

# [0.1.0](https://github.com/flayks/sanity-plugin-remote-files/compare/v0.0.0...v0.1.0) (2026-07-07)


### Bug Fixes

* prepare experimental release ([e36b11a](https://github.com/flayks/sanity-plugin-remote-files/commit/e36b11ab602a847ffc9cc749375a6954c7f22891))


### Features

* setup deployment ([d1201c8](https://github.com/flayks/sanity-plugin-remote-files/commit/d1201c8e2312844cc7689663747e72ce27e5d84f))
