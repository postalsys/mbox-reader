'use strict';

// usage:
// $ cat large-mailbox.mbox | node example.js

const { mboxReader } = require('../lib/mbox-reader');

let counter = 0;
let start = Date.now();

const main = async () => {
    let stream = process.stdin;
    for await (let message of mboxReader(stream)) {
        console.table({
            nr: ++counter,
            returnPath: message.returnPath,
            time: message.time.toISOString(),
            size: message.content.length
        });
    }
};

main()
    .catch(err => console.error(err))
    .finally(() => console.log('%s messages processed in %s seconds', counter, (Date.now() - start) / 1000));
