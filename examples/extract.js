'use strict';

// This example script extracts mbox file to eml files
// Usage:
// $ cat large-mailbox.mbox | node extract.js /output/folder/

const fs = require('fs').promises;
const { mboxReader } = require('../lib/mbox-reader');
const Path = require('path');

let counter = 0;
let start = Date.now();

const main = async () => {
    let stream = process.stdin;
    for await (let message of mboxReader(stream)) {
        let fName = (++counter).toString();
        if (fName.length < 6) {
            fName = '0'.repeat(6 - fName.length) + fName;
        }
        let fPath = Path.join(process.argv[2] || '.', `extracted-${fName}.eml`);

        await fs.writeFile(fPath, message.content);

        process.stdout.write('.');
    }
};

main()
    .catch(err => console.error(err))
    .finally(() => console.log('\n%s messages extracted in %s seconds', counter, (Date.now() - start) / 1000));
