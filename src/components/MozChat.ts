import { LitElement, html, css } from 'lit'

class MozChat extends LitElement {
  static properties = {}

  static styles = css`
    .wrapper {
      display: block;
      padding: 10px;
      color: #ffffff;
      height: calc(100vh - 46px);
      background-color: #202020;
    }
  `

  constructor() {
    super()
  }

  render() {
    return html`
      <div class="wrapper">
        <p>Example: This is the chat feature.</p>
      </div>
    `
  }
}

export default MozChat
