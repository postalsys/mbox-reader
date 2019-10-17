'use strict';

const Transform = require('stream').Transform;

class MboxReader extends Transform {
    constructor() {
        super({
            readableObjectMode: true,
            writableObjectMode: false
        });

        this._remainder = '';
        this._state = 'none';
        this.lines = [];

        this.message = false;
    }

    _flushMessage(callback) {
        if (!this.message) {
            return callback();
        }

        let msg = this.message;
        this.message = false;

        if (msg.lines.length && msg.lines[msg.lines.length - 1] === '') {
            // remove final empty line if present
            msg.lines.pop();
        }

        let headerLines = [];
        for (let i = 0; i < msg.lines.length; i++) {
            if (!msg.lines[i]) {
                break;
            }
            if (/^\s/.test(msg.lines[i]) && headerLines.length) {
                headerLines[headerLines.length - 1] += msg.lines[i];
            } else {
                headerLines.push(msg.lines[i]);
            }
        }

        let headers = new Map();
        headerLines.forEach(line => {
            let splitter = line.indexOf(':');
            let key = line
                .substr(0, splitter)
                .trim()
                .toLowerCase();
            let value = line
                .substr(splitter + 1)
                .replace(/\s+/g, ' ')
                .trim();
            if (headers.has(key)) {
                headers.get(key).push(value);
            } else {
                headers.set(key, [value]);
            }
        });

        let flags = new Set();
        []
            .concat(headers.has('status') ? headers.get('status') : [])
            .concat(headers.has('x-status') ? headers.get('x-status') : [])
            .forEach(row => {
                row = row.toLowerCase();
                if (row.indexOf('r') >= 0) {
                    flags.add('\\Seen');
                }
                if (row.indexOf('a') >= 0) {
                    flags.add('\\Answered');
                }
                if (row.indexOf('f') >= 0) {
                    flags.add('\\Flagged');
                }
                if (row.indexOf('t') >= 0) {
                    flags.add('\\Draft');
                }
                if (row.indexOf('d') >= 0) {
                    flags.add('\\Deleted');
                }
            });

        this.push({
            returnPath: msg.returnPath,
            time: msg.time,
            content: Buffer.from(msg.lines.join('\n'), 'binary'),
            headers,
            flags,
            next: callback
        });
    }

    _createMessage(returnPath, time, callback) {
        this._flushMessage(() => {
            this.message = {
                returnPath,
                time,
                lines: []
            };
            callback();
        });
    }

    _processLines(callback) {
        let nextLine = () => {
            if (!this.lines.length) {
                return callback();
            }

            let line = this.lines.shift();

            if (line.substr(0, 5) === 'From ') {
                // first line
                let words = line.split(/\s+/);
                words.shift();
                let returnPath = words.shift();
                let time = new Date(words.join(' '));
                if (time.toString() === 'Invalid Date') {
                    time = false;
                }

                return this._createMessage(returnPath, time, nextLine);
            }

            if (/^>+From /.test(line)) {
                line = line.substr(1);
            }

            if (this.message) {
                this.message.lines.push(line);
            }

            nextLine();
        };

        nextLine();
    }

    _transform(chunk, encoding, callback) {
        let data = chunk.toString('binary');
        if (this._remainder) {
            data = this._remainder + data;
            this._remainder = '';
        }

        let lines = data.split(/\r?\n/);
        this._remainder = lines.pop();

        lines.forEach(line => {
            this.lines.push(line);
        });

        this._processLines(() => {
            callback();
        });
    }

    _flush(callback) {
        if (this._remainder) {
            let lines = this._remainder.split(/\r?\n/);
            this._remainder = '';
            lines.forEach(line => {
                this.lines.push(line);
            });

            this._processLines(() => {
                this._flushMessage(callback);
            });
        } else {
            this._flushMessage(callback);
        }
    }
}

let eachMessage = async function*(sourceStream) {
    let rowQueue = [];
    let finished = false;

    let errored = false;
    let waitNext = false;

    let getNext = () => {
        return new Promise((resolve, reject) => {
            if (rowQueue.length) {
                let { err, row } = rowQueue.shift();
                if (err) {
                    return reject(err);
                }
                return resolve(row);
            }

            if (finished) {
                return resolve(null);
            }

            waitNext = (err, row) => {
                if (err) {
                    return reject(err);
                }
                return resolve(row);
            };
        });
    };

    let push = (err, row) => {
        if (errored) {
            return;
        }
        if (waitNext) {
            let w = waitNext;
            waitNext = false;
            w(err, row);
        } else {
            rowQueue.push({ err, row });
        }
    };

    let finish = err => {
        if (err) {
            push(err);
        }
        finished = true;
        push(null, null);
    };

    let mr = new MboxReader();
    let mbox = sourceStream.pipe(mr);

    let reading = false;
    let readNext = () => {
        let part = mr.read();
        if (part === null) {
            reading = false;
            return;
        }
        push(null, part);
    };

    mbox.on('readable', () => {
        if (!reading) {
            return readNext();
        }
    });

    mbox.once('end', () => finish());
    mbox.once('error', finish);
    sourceStream.once('error', finish);

    while (true) {
        let res = await getNext();
        if (res !== null || !finished) {
            yield {
                returnPath: res.returnPath,
                time: res.time,
                content: res.content,
                headers: res.headers,
                flags: res.flags
            };
            res.next();
        } else {
            break;
        }
    }
};

module.exports.MboxReader = MboxReader;
module.exports.eachMessage = eachMessage;
