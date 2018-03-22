import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as hljs from 'highlight.js/lib/highlight';
import * as bashLanguage from 'highlight.js/lib/languages/bash';
import * as javascriptLanguage from 'highlight.js/lib/languages/javascript';

export default class Highlight extends React.PureComponent<{
  className: string;
}, null> {
  componentDidMount() {
    this.highlightCode();
  }

  componentDidUpdate() {
    this.highlightCode();
  }

  highlightCode() {
    const { className } = this.props;
    const domNode = ReactDOM.findDOMNode(this);
    const nodes = domNode.querySelectorAll('pre code');

    hljs.registerLanguage('javascript', javascriptLanguage);
    hljs.registerLanguage('bash', bashLanguage);

    let i;
    for (i = 0; i < nodes.length; i += 1) {
      hljs.highlightBlock(nodes[i]);
    }
  }

  render() {
    const { children, className } = this.props;
    return (
      <pre>
        <code className={className}>
          {children}
        </code>
      </pre>
    );
  }
}
