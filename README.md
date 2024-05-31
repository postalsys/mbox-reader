# MboxReader

Reads email messages from a MBOX file. Output is an async generator where messages are yielded one by one.

MboxReader supports very large (multi gigabyte) mbox files as messages are processed asynchronously.

**NB!** _mboxcl2_ formatted mbox files are not supported as MboxReader assumes From-munging.

## Usage

First install the module from NPM:

```
$ npm install mbox-reader
```

next import the `mboxReader` generator function into your script:

```js
const { mboxReader } = require('mbox-reader');
```

### Listing messages

```
mboxReader(readableStream, [options]) -> async generator
```

Where

-   **options** is an optional options object
    -   **gz** _{Boolean}_ indicates if the input is a gz file (eg. _gmail-takeout.mbox.gz_). Default is `false`.

Generator yields objects with the following properties:

-   **returnPath** Sender email address
-   **time** Sending time as a Date object or `false` if date was not parseable
-   **content** is a Buffer with the RFC822 formatted message
-   **flags** an Array of IMAP compatible flags derived from Status or X-Status headers
-   **labels** an Array of Gmail labels (ie. mailbox names) from X-Gmail-Labels headers
-   **headers** a Map of headers where key is a lowercase header key and value is an array of header lines for this key (without the key prefix)

**Example**

Example reads mbox file from standard input and writes messages to console.

```js
const { mboxReader } = require('mbox-reader');

for await (let message of mboxReader(process.stdin)) {
    console.log(message.returnPath);
    console.log(message.time);
    process.stdout.write(message.content);
}
```

## License

&copy; 2020 - 2024 Postal Systems OÜ

Licensed under the MIT license.
