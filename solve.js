// Fast drop-in for csv-reader 1.0.0: run(input) returns exactly the answer
// csv-reader's readCsv returns for {text, header} — {columns, rows, errors} —
// but scans with tight charCodeAt loops and slice instead of one character at
// a time. The unquoted scan is inlined into the record loop.
//
// Semantics (mirroring the reference): a U+FEFF at the very start is dropped;
// a record ends at LF or CRLF, a line with no characters is no record; outside
// quotes a CR not followed by LF is dropped (stray_cr); a field opening with a
// quote runs to the next non-doubled quote ("" inside it is one quote, each
// CRLF or lone CR inside it reads as LF); what follows the closing quote, up
// to the next comma or line break, is appended as it stands (quote_junk, when
// the field ends); a quote that never closes is literal and the text after it
// is read again as unquoted (unterminated_quote); a quote inside an unquoted
// field is literal; fields stay strings, never trimmed or converted; columns
// is the first record when header is true, else null; rows are the records
// after it, each padded with "" (short_row) or cut (long_row) to the first
// record's width; each error is {code, line, row} in the order met.

const COMMA = 0;
const BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  // Processes one quoted segment [a, b): converts CRLF/lone CR to LF, counts
  // the line breaks it holds, and returns the segment's value.
  function qseg(a, b) {
    const seg = text.slice(a, b);
    if (seg.indexOf('\r') === -1 && seg.indexOf('\n') === -1) return seg;
    let lb = 0;
    for (let j = 0; j < seg.length; j++) {
      const c = seg.charCodeAt(j);
      if (c === 10) lb++;
      else if (c === 13) {
        lb++;
        if (j + 1 < seg.length && seg.charCodeAt(j + 1) === 10) j++;
      }
    }
    line += lb;
    return seg.indexOf('\r') === -1 ? seg : seg.replace(/\r\n?/g, '\n');
  }

  // Reads an unquoted field onto `val` up to the next comma or line break.
  // Returns [value, ended, added]: ended is COMMA, BREAK or END; added counts
  // the characters kept. A lone CR is dropped (stray_cr) and the field goes on.
  // Used only for the quote-junk tail after a closing quote; the record loop
  // inlines this scan for its own fields.
  function unquoted(val) {
    let v = val;
    let added = 0;
    for (;;) {
      let i = pos;
      while (i < n) {
        const c = text.charCodeAt(i);
        if (c === 44 || c === 10 || c === 13) break;
        i++;
      }
      if (i >= n) {
        if (pos < n) {
          v += text.slice(pos, n);
          added += n - pos;
        }
        pos = n;
        return [v, END, added];
      }
      const c = text.charCodeAt(i);
      if (c === 44) {
        v += text.slice(pos, i);
        added += i - pos;
        pos = i + 1;
        return [v, COMMA, added];
      }
      if (c === 10) {
        v += text.slice(pos, i);
        added += i - pos;
        pos = i + 1;
        line += 1;
        return [v, BREAK, added];
      }
      // CR: CRLF ends the record, a lone CR is dropped (stray_cr).
      if (i + 1 < n && text.charCodeAt(i + 1) === 10) {
        v += text.slice(pos, i);
        added += i - pos;
        pos = i + 2;
        line += 1;
        return [v, BREAK, added];
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      v += text.slice(pos, i);
      added += i - pos;
      pos = i + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  // Returns [value, ended, added] like unquoted.
  function quoted() {
    const open = pos;
    const openLine = line;
    let v = '';
    let p = pos + 1;
    let segStart = p;
    for (;;) {
      const i = text.indexOf('"', p);
      if (i === -1) {
        // The quote never closes: literal, the text after it read as unquoted.
        pos = open + 1;
        line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return unquoted('"');
      }
      if (i + 1 < n && text.charCodeAt(i + 1) === 34) {
        // Doubled quote: one quote in the value.
        v += qseg(segStart, i);
        v += '"';
        p = i + 2;
        segStart = i + 2;
        continue;
      }
      // Closing quote.
      v += qseg(segStart, i);
      pos = i + 1;
      if (pos >= n) return [v, END, 0];
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return [v, COMMA, 0];
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return [v, BREAK, 0];
      }
      if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return [v, BREAK, 0];
      }
      // What follows the closing quote is appended as it stands.
      const junk = unquoted(v);
      if (junk[2] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      return junk;
    }
  }

  // Finishes a record: header, or a row padded/cut to the first record's width.
  function finish(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    // Fast path: this line holds no quote and no lone CR, so it is plain
    // comma-separated fields. (A trailing CR here is its CRLF's, never a lone one.)
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? n : nl;
    let segEnd = lineEnd;
    if (nl !== -1 && segEnd > pos && text.charCodeAt(segEnd - 1) === 13) segEnd -= 1;
    const iq = text.indexOf('"', pos);
    const ir = text.indexOf('\r', pos);
    if ((iq === -1 || iq >= lineEnd) && (ir === -1 || ir >= segEnd)) {
      if (segEnd === pos) {
        pos = nl === -1 ? n : nl + 1;
        line += 1;
        continue;
      }
      const fields = text.slice(pos, segEnd).split(',');
      pos = nl === -1 ? n : nl + 1;
      line += 1;
      finish(fields);
      continue;
    }

    // Slow path: the line holds a quote or a lone CR; read it field by field.
    // The unquoted scan is inlined here; quoted fields go through quoted().
    const fields = [];
    let ended = COMMA;
    let quotedLast = false;
    while (ended === COMMA) {
      if (text.charCodeAt(pos) === 34) {
        quotedLast = true;
        const f = quoted();
        fields.push(f[0]);
        ended = f[1];
        continue;
      }
      quotedLast = false;
      // Inline unquoted scan onto `v`, starting fresh for this field.
      let v = '';
      for (;;) {
        let i = pos;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 44 || c === 10 || c === 13) break;
          i++;
        }
        if (i >= n) {
          if (pos < n) v += text.slice(pos, n);
          pos = n;
          ended = END;
          break;
        }
        const c = text.charCodeAt(i);
        if (c === 44) {
          v += text.slice(pos, i);
          pos = i + 1;
          ended = COMMA;
          break;
        }
        if (c === 10) {
          v += text.slice(pos, i);
          pos = i + 1;
          line += 1;
          ended = BREAK;
          break;
        }
        if (i + 1 < n && text.charCodeAt(i + 1) === 10) {
          v += text.slice(pos, i);
          pos = i + 2;
          line += 1;
          ended = BREAK;
          break;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        v += text.slice(pos, i);
        pos = i + 1;
      }
      fields.push(v);
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !quotedLast) continue;
    finish(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
