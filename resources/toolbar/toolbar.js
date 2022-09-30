export class Toolbar extends Element {
  constructor(props) {
    super();
    this.app = props.app;
  }

  render() {
    return <toolbar styleset={__DIR__ + "toolbar.css#toolbar"}>
      <button title="Add Texture" name="add" disabled={this.app.loading} />
      <button title="Delete Texture" name="delete" disabled={this.app.loading} />
    </toolbar>;
  }
}

class VerticalDivider extends Element {
  render() {
    return <div styleset={__DIR__ + "toolbar.css#vr"} />
  }
}