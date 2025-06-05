export module 'mbox-reader' {
    /**
     * gz: indicates if the input is a gz file (eg. gmail-takeout.mbox.gz). Default is false.
     */
    export function mboxReader(
        sourceStream: ReadableStream,
        options: { gz: boolean }
    ): AsyncGenerator<mboxMessage>;
}

export interface mboxMessage {
    returnPath: string;
    time: Date | false;
    content: Buffer;
    flags: string[];
    labels: string[];
    headers: Map<string, string[]>;
}
