export function hex(byte) {
  const chars = '0123456789abcdef';
  const char1 = chars[(byte >> 4) & 0x0f];
  const char2 = chars[byte & 0x0f];
  return `0x${char1}${char2}`;
}

export function formatBytes(bytes, si = false, dp = 1) {
  bytes = Number(bytes.toString());

  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


  return bytes.toFixed(dp) + ' ' + units[u];
}

export function reverseUint32(val) {
  return ((val & 0xFF) << 24)
    | ((val & 0xFF00) << 8)
    | ((val >> 8) & 0xFF00)
    | ((val >> 24) & 0xFF);
}

export function reverseEndianness(array) {
  var u8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (var i = 0; i < array.byteLength; i += array.BYTES_PER_ELEMENT) {
    for (var j = i + array.BYTES_PER_ELEMENT - 1, k = i; j > k; j--, k++) {
      var tmp = u8[k];
      u8[k] = u8[j];
      u8[j] = tmp;
    }
  }
  return new Uint8Array([...new Uint8Array(array.buffer).reverse()]);
};

