# check-dependencies

> Checks if currently installed npm/bower dependencies are installed in the exact same versions that are specified in package.json/bower.json

[![Build Status](https://travis-ci.org/mzgol/check-dependencies.svg?branch=master)](https://travis-ci.org/mzgol/check-dependencies)
[![Build status](https://ci.appveyor.com/api/projects/status/a4cok143mjmi0hk3/branch/master)](https://ci.appveyor.com/project/mzgol/check-dependencies)

(Note: the package previously published under this name is now called [dependency-status](https://www.npmjs.org/package/dependency-status))

## Installation

To install the package and add it to your `package.json`, invoke:

```shell
npm install check-dependencies --save-dev
```

## Rationale

When dependencies are changed in `package.json` (or `bower.json`), whether it's a version bump or a new package, one can forget to invoke `npm install` (or `bower install`) and continue using the application, possibly encountering errors caused by obsolete package versions. To avoid it, use the `check-dependencies` module at the top of the entry point of your application; it will inform about not up-to-date setup and optionally install the dependencies.
 
Another option would be to always invoke `npm install` (or `bower install`) at the top of the main file but it can be slow and `check-dependencies` is fast.

## Usage

Once the package has been installed, it may be used via:

```js
require('check-dependencies')(config, callback);
```
where `callback` is invoked upon completion and `config` is a configuration object.

`callback` is invoked with the object containing fields:
```js
{
    status: number,      // 0 if successful, 1 otherwise
    depsWereOk: boolean, // true if dependencies were already satisfied
    output: array,       // array of logged messages
    error: array,        // array of logged errors
}
```
 `log` and `error` - arrays aggregating informational and error
messages. The operation was successful if

The `config` object can have the following fields:

### packageManager

Package manager to check against. Possible values: `'npm'`, `'bower'`. (Note: for `bower` you need to have the `bower` package installed either globally or locally in the same project in which you use `check-dependencies`).

Type: `string`

Default: `'npm'`

### packageDir

Path to the directory containing `package.json`.

Type: `string`

Default: the closest directory containing `package.json` when going up the tree, starting from the current one

### install

Installs packages if they don't match.

Type: `boolean`

Default: `false`

### scopeList

The list of keys in package.json where to look for package names & versions.

Type: `array`

Default: `['dependencies', 'devDependencies']`

### verbose

Prints messages to the console.

Type: `boolean`

Default: `false`

### log

A function logging debug messages (applies only if `verbose: true`).

Type: `function`

Default: `console.log.bind(console)`

### error

A function logging error messages (applies only if `verbose: true`).

Type: `function`

Default: `console.error.bind(console)`

## Usage Examples

The most basic usage:
```js
require('check-dependencies')(callback);
```
This will check packages' versions, install mismatched ones and invoke `callback`.

The following:
```js
require('check-dependencies')({
    install: false,
    verbose: true,
}, callback);
```
will report an error to `callback` if packages' versions are mismatched.

The following two examples:
```js
require('check-dependencies')(callback);
require('check-dependencies')({}, callback);
```
behave in the same way - `callback` is invoked upon completion; if there was an error, it's passed as a parameter to `callback`.

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using `npm test`.

## License
Copyright (c) 2014 Michał Gołębiowski. Licensed under the MIT license.
