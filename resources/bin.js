import { fs } from '@sys';
import { decode } from '@sciter';
import { hex, reverseEndianness, formatBytes } from 'format-bytes.js';

export class BinFile {

  constructor(filename) {
    this.filename = filename;
  }

  async close() {
    await this.file.close();
  }

  async load(progressCallback) {
    this.file = await fs.open(this.filename, 'r');
    await this.loadMagicBytes();
    await this.loadSize();
    await this.loadDataTable();
    return this;
  }

  async loadMagicBytes() {
    return this.magicBytes = new Uint8Array(await this.file.read(4, 0));
  }

  async loadSize() {
    return this.size = Number((await this.file.stat()).st_size);
  }

  async loadDataTable() {
    this.dataTable = new Array(new Uint32Array(await this.file.read(4, 8))[0]);
    this.dataTable.offset = new Uint32Array(await this.file.read(4, 12))[0];

    let i = 0;
    for (let p = this.dataTable.offset; p < (this.dataTable.length * 8) + this.dataTable.offset; p += 8) {
      const [uncompressedSize] = new Uint32Array(await this.file.read(4, p)).reverse();
      const [offset] = new Uint32Array(await this.file.read(4, p + 4)).reverse();
      this.dataTable[i] = { offset, uncompressedSize };
      i++;
    }
  }

  async loadTextures(progressCallback) {
    this.textures = this.dataTable.map(({ offset, uncompressedSize }, i) => {
      return new Texture(this.file, {
        offset,
        uncompressedSize,
        size: (this.dataTable[i + 1]?.offset || this.size) - this.dataTable[i].offset,
        index: i
      });
    });

    const promises = this.textures
      .map(texture => texture
        .load()
        .then((texture) => progressCallback(texture, this.textures.length))
      );

    await Promise.all(promises);

    return this.textures;
  }

  static async extractTextures(textures, folder, progressCallback) {
    const promises = textures.map(async (texture, i) => {
      const filename = texture.filename;
      const extension = texture.extension === 'gz' ? `.${texture.extension}` : '';
      const path = `${folder}/${filename}${extension}`;
      const file = await fs.open(path, 'w');
      await file.write(texture.bytes);
      await file.close();
      progressCallback(texture, textures.length);
    });
    await Promise.all(promises);
  }

  static async saveTexturesAsBin(filename, textures, progressCallback) {
    const totalTextureSize = textures.map(({ size }) => size).reduce((sum, n) => sum + n, 0);
    const fileSize = 16 + textures.length * 8 + totalTextureSize;
    const bytes = new Uint8Array(fileSize);

    const magicBytes = [0x50, 0x42, 0x49, 0x4e];
    const textureCount = new Uint8Array(new Uint32Array([textures.length]).buffer);
    const dataTableOffset = [0x10, 0x00, 0x00, 0x00];

    const header = [
      ...magicBytes,
      0x00, 0x00, 0x00, 0x00,
      ...textureCount,
      ...dataTableOffset
    ];

    let offset = header.length + textures.length * 8;
    const dataTable = textures.map((texture) => {
      const { uncompressedSize, size } = texture;
      const row = [
        ...new Uint8Array(new Uint32Array([uncompressedSize]).buffer),
        ...new Uint8Array(new Uint32Array([offset]).buffer)
      ];
      texture.newOffset = offset;
      offset += size;
      return row;
    }).flat(1);

    bytes.set(header);
    bytes.set(dataTable, header.length);

    for (const texture of textures) {
      bytes.set(texture.bytes, texture.newOffset);
      progressCallback(texture, textures.length);
    }

    const file = await fs.open(filename, 'w');
    await file.write(bytes);
    await file.close();
  }

}

export class Texture {
  constructor(file, {
    offset = 0,
    uncompressedSize = 0,
    size,
    index = -1,
    filename = null
  }) {
    this.file = file;
    this.offset = offset;
    this.uncompressedSize = uncompressedSize;
    this.size = size;
    this.index = index;
    this.key = Math.random();
    this.filename = filename;
  }

  async load() {
    await this.loadBytes();
    this.identifyFormat();
    return this;
  }

  async loadBytes() {
    this.bytes = new Uint8Array(await this.file.read(this.size, this.offset));
  }

  identifyFormat() {
    if (this.bytes[0] === 0x1f && this.bytes[1] === 0x8b) {
      this.extension = 'gz';
      this.identifyFilename();
      this.identifyUncompressedSize();
    } else {
      const magicText = decode(new Uint8Array(this.bytes.subarray(0, 4)).buffer);
      magicText === 'Tex1' && (this.extension = 'img');
    }
  }

  identifyFilename() {
    const flags = this.bytes[3];
    const FNAME = 0x08;
    if (flags & FNAME) {
      for (let i = 10; i < this.bytes.length; i++) {
        if (this.bytes[i] === 0x00) {
          this.filename = decode(new Uint8Array(this.bytes.subarray(10, (i - 10) + 10)).buffer);
          break;
        }
      }
    }
  }

  identifyUncompressedSize() {
    this.uncompressedSize = new Uint32Array(
      new Uint8Array(this.bytes.slice(-4)).buffer
    )[0];
  }
}
