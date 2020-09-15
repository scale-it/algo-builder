import { assert } from "chai";

import { TxWriterImpl } from "../../src/internal/tx-log-writer";

class TxWriterMock extends TxWriterImpl {
  writtenContent = [] as any;

  push (filename: any, content: any): void {
    this.writtenContent.push({ filename, content });
  }
}

describe("Log Writer", () => {
  const writer = new TxWriterMock('');

  it("change script name", () => {
    writer.setScriptName('sc-1.js');
    assert.equal('sc-1.js', writer.scriptName);
  });

  it("Write files", () => {
    writer.writtenContent.pop();
    writer.push('WriteFile', { file: 'file1' });
    assert.deepEqual(writer.writtenContent, [{
      filename: "WriteFile",
      content: { file: "file1" }
    }]);
  });
});
