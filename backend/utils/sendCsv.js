const { Readable } = require('stream');

const CHUNK_SIZE = 64 * 1024;

/**
 * Send CSV as chunked transfer with no Content-Length.
 * A hosted reverse proxy can start the file download immediately
 * instead of waiting until the whole body is buffered.
 */
const sendCsv = (res, csv) => {
  const body = Buffer.from(csv == null ? '' : String(csv));

  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  }
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Cache-Control', 'no-store');

  let offset = 0;
  const stream = new Readable({
    read() {
      if (offset >= body.length) {
        this.push(null);
        return;
      }
      const end = Math.min(offset + CHUNK_SIZE, body.length);
      this.push(body.subarray(offset, end));
      offset = end;
    },
  });

  res.status(200);
  stream.pipe(res);
};

module.exports = { sendCsv };
