import { Toolbar } from 'toolbar/toolbar.js';
import { Content } from 'content/content.js';
import { StatusBar } from 'status/status-bar.js';

import { fs } from '@sys';
import { home } from '@env';

import { BinFile, Texture } from 'bin.js';

export class Application extends Element {
  status = 'Welcome to Texture Archive Editor!';
  progressVal = 0;
  progressMax = 100;
  textures = [];
  loading = false;
  binFile = null;

  constructor() {
    super();
  }

  checkIfLoading() {
    if (this.loading) {
      Window.this.modal(<error caption="Error">Task in progress, please wait.</error>);
      return true;
    }
    return false;
  }

  componentDidMount() {
    document.on('click', 'menu(file) > li(open)', async () => {

      if (this.checkIfLoading()) return;

      this.componentUpdate({ loading: true });
      this.patch(this.render());
      Window.this.update();

      const filename = Window.this
        .selectFile({
          mode: 'open',
          filter: 'BIN Files (*.bin)|*.bin|All (*.*)|*.*',
          caption: 'Open',
        })
        ?.replace('file://', '')
        ?.replace(/.+/, (filename) => decodeURIComponent(filename));

      if (!filename) {
        this.componentUpdate({ loading: false });
        this.patch(this.render());
        Window.this.update();
        return;
      }

      await this.loadBinFile(filename);
    });

    document.on('click', 'menu(file) > li(new)', async () => {
      if (this.checkIfLoading()) return;
      const response = Window.this.modal(<question caption="New">Are you sure you want to start a new file?</question>);
      if (response === 'no') return;
      await this.binFile?.close();
      this.componentUpdate({
        textures: [],
        binFile: null,
        status: 'Cleared texture list.'
      });
    });

    document.on('click', 'menu > li(delete), button(delete)', () => {
      if (this.checkIfLoading()) return;
      const selectedOption = this.$(':checked');
      if (!selectedOption) {
        Window.this.modal(<error caption="Error">No texture selected.</error>);
        return;
      }
      const textures = [...this.textures];
      const index = textures.findIndex(({ key }) => key === Number(selectedOption.attributes.key));

      const texture = textures[index];
      const response = Window.this.modal(<question caption="Delete">Are you sure you want to delete "{texture.filename}"?</question>);
      if (response === 'no') return;

      textures.splice(index, 1);
      this.componentUpdate({ textures, status: `Deleted texture "${texture.filename}"` });
    });

    const onAdd = async () => {
      if (this.checkIfLoading()) return;
      const selection = Window.this
        .selectFile({
          mode: 'open-multiple',
          filter: 'Texture Files (*.img;*.gz)|*.img;*.gz',
          caption: 'Add texture...',
        });

      if (!selection) return;

      const filenames = (Array.isArray(selection) ? selection : [selection])
        .map(filename => filename
          .replace('file://', '')
          .replace(/.+/, (filename) => decodeURIComponent(filename))
        );

      this.componentUpdate({ loading: true, progressVal: 0, progressMax: filenames.length });

      for (const filename of filenames) {
        const file = await fs.open(filename, 'r');

        let name = filename.match(/[^\\/]+$/)[0].replace(/\.gz$/, '');
        const matchIndex = this.textures.findIndex(tex => name === tex.filename);
        const match = this.textures[matchIndex];
        let response = null;

        if (match) {
          response = Window.this.modal(<question caption="Replace">
            There is already a texture in the list named "{name}".<br />
            Replace it?
          </question>);
          if (response === undefined) response = null;
        }
        console.log(response);

        const texture = new Texture(file, {
          size: Number((await file.stat()).st_size),
          filename: name,
          index: this.textures.length - 1
        });

        if (response === 'yes') {
          texture.index = match.index;
        }

        await texture.load();

        if (texture.extension === 'img') {
          texture.uncompressedSize = texture.size;
        }

        const textures = [...this.textures];
        if (response === 'no' || response === null) {
          textures.push(texture);
        } else if (response === 'yes') {
          textures.splice(matchIndex, 1, texture);
        }

        this.componentUpdate({
          textures,
          progressVal: this.progressVal + 1,
          status: `Adding texture ${this.progressVal + 1} / ${this.progressMax} ...`
        });

        this.patch(this.render());
        Window.this.update();
      }

      this.componentUpdate({
        progressVal: 0,
        progressMax: 100,
        status: `Added ${this.progressVal} textures.`,
        loading: false
      });

      this.patch(this.render());
      Window.this.update();
    };

    document.on('click', 'menu(edit) > li(add), button(add)', onAdd);
    document.on('keydown', (evt) => evt.code === 'Delete' && document.$('li(delete)').click());

    document.on('click', 'menu(file) > li(extract)', async () => {
      if (this.checkIfLoading()) return;
      if (!this.textures.length) {
        Window.this.modal(<error caption="Error">No textures to extract.</error>);
        return;
      }

      const folder = Window.this
        .selectFolder({
          mode: 'save',
          path: home(['']),
          caption: 'Extract textures to...',
        })
        ?.replace('file://', '')
        ?.replace(/.+/, (folder) => decodeURIComponent(folder));

      if (!folder) return;

      this.componentUpdate({ loading: true, progressVal: 0 });

      await BinFile.extractTextures(this.textures, folder, (texture, progressMax) => {
        this.componentUpdate({
          progressVal: this.progressVal + 1,
          progressMax,
          status: `Extracting "${texture.filename}" (${this.progressVal + 1} / ${progressMax}) ...`
        });
        this.patch(this.render());
        Window.this.update();
      });

      this.componentUpdate({
        status: `Extracted ${this.progressVal} textures to "${folder}"`,
        loading: false,
        progressVal: 0,
        progressMax: 100
      });
      this.patch(this.render());
      Window.this.update();
    });

    document.on('click', 'menu(edit) > li(extract)', async () => {
      if (this.checkIfLoading()) return;
      if (!this.$(':checked')) {
        Window.this.modal(<error caption="Error">No texture selected.</error>);
        return;
      }

      const texture = this.textures.find(({ key }) => Number(this.$(':checked').attributes.key) === key);

      const folder = Window.this
        .selectFolder({
          mode: 'save',
          path: home(['']),
          caption: 'Extract texture to...',
        })
        ?.replace('file://', '')
        ?.replace(/.+/, (folder) => decodeURIComponent(folder));

      if (!folder) return;

      this.componentUpdate({ loading: true, progressVal: 0, progressMax: 100 });

      await BinFile.extractTextures([texture], folder, (texture, progressMax) => {
        this.componentUpdate({
          progressVal: this.progressVal + 1,
          progressMax,
          status: `Extracting "${texture.filename}" to "${folder}"...`
        });
        this.patch(this.render());
        Window.this.update();
      });

      this.componentUpdate({
        status: `Extracted to "${folder}/${texture.filename}"`,
        loading: false,
        progressVal: 0,
        progressMax: 100
      });
      this.patch(this.render());
      Window.this.update();
    });

    document.on('click', 'menu(file) > li(save)', async () => {
      if (this.checkIfLoading()) return;
      if (!this.textures.length) {
        Window.this.modal(<error caption="Error">No textures to save.</error>);
        return;
      }

      const filename = Window.this
        .selectFile({
          mode: 'save',
          filter: 'BIN files (*.bin)|*.bin',
          caption: 'Save textures to BIN file...',
        })
        ?.replace('file://', '')
        ?.replace(/.+/, (filename) => decodeURIComponent(filename));

      if (!filename) return;

      this.componentUpdate({
        loading: true,
        status: `Saving textures to "${filename}"...`,
        progressVal: 0,
        progressMax: 100
      });

      await BinFile.saveTexturesAsBin(filename, this.textures, (texture, progressMax) => {
        this.componentUpdate({
          progressVal: this.progressVal + 1,
          progressMax,
          status: `Saving "${texture.filename}" (${this.progressVal + 1} / ${progressMax}) to "${filename}"...`
        });
      });

      this.componentUpdate({
        loading: false,
        status: `Saved ${this.textures.length} textures to "${filename}"`,
        progressVal: 0,
        progressMax: 100
      });
    });
  }

  async loadBinFile(filename) {
    await this.binFile?.close();

    this.componentUpdate({
      textures: [],
      loading: true,
      progressVal: 0.1,
      progressMax: 100,
      status: `Loading file "${filename}"...`
    });

    this.patch(this.render());
    Window.this.update();

    this.componentUpdate({ binFile: await (new BinFile(filename)).load() });

    await this.binFile.loadTextures((texture, progressMax) => {
      this.componentUpdate({
        progressVal: Math.round(this.progressVal) + 1,
        progressMax,
        status: `Loading texture ${this.progressVal + 1} / ${progressMax} ...`,
        textures: [texture, ...this.textures]
      });
      this.patch(this.render());
      Window.this.update();
    });
    this.textures.forEach((texture, i) => {
      if (!texture.filename) {
        const { extension: ext } = texture;
        texture.filename = `Tex1_${String(i).padStart(3, 0)}${ext ? '.' + ext : ''}`;
      }
    });
    this.componentUpdate({
      status: `Loaded ${this.progressVal} textures.`,
      loading: false,
      progressVal: 0,
      progressMax: 100,
      textures: this.textures.sort((a, b) => a.index - b.index)
    });
    this.patch(this.render());
    Window.this.update();

  }

  render() {
    return (
      <body>
        <Toolbar app={this} />
        <Content app={this} />
        <StatusBar app={this} />
      </body>
    );
  }
}


