import { css } from 'lit'

export const FeatureViewStyles = css`
  :host {
    --color-bg: #202020;
    --color-link: #1e90ff;
    --color-fg: #ffffff;
    --color-border: #007bff;
    --color-input-bg: #424242;
    --color-secondary-hover: #585858;
    --color-loader-bg: #424242;
    --color-response-bg: #2d2c2c;
    --color-gradient-start: #2e3133;
    --color-gradient-end: #4b4e52;
    --color-primary-disabled: #6d6d6d;
    --color-fg-subtle: #b0b0b0;
    --color-primary: #007bff;
  }

  a {
    color: var(--color-link);
  }

  .title {
    font-size: 16px;
    font-weight: 300;
    margin-bottom: 0;
  }

  .text-input {
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    margin-bottom: 10px;
    background-color: var(--color-input-bg);
    color: var(--color-fg);
  }

  .primary-button {
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    background-color: var(--color-border);
    color: var(--color-fg);
    border-radius: 4px;
    cursor: pointer;

    &:disabled {
      background-color: var(--color-primary-disabled);
      border-color: var(--color-primary-disabled);
      cursor: not-allowed;
    }
  }

  .secondary-button {
    padding: 8px 12px;
    color: var(--color-fg);
    border: 1px solid var(--color-fg);
    border-radius: 4px;
    cursor: pointer;
    background-color: transparent;
  }

  .secondary-button:hover {
    background-color: var(--color-secondary-hover);
  }

  .example-buttons {
    display: flex;
    gap: 8px;
    flex-direction: column;
    margin-bottom: 20px;
  }

  .label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
  }

  @keyframes pulse {
    0% {
      background-color: var(--color-loader-bg);
    }
    50% {
      background-color: var(--color-secondary-hover);
    }
    100% {
      background-color: var(--color-loader-bg);
    }
  }

  .loader {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    background-color: var(--color-loader-bg);
    border-radius: 4px;
    color: var(--color-fg);
    animation: pulse 1.5s infinite;
  }

  hr {
    border: none;
    border-top: 1px solid var(--color-secondary-hover);
    margin: 20px 0;
  }
`
