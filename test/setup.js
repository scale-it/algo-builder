import sinon from 'sinon';

const levels = ['log', 'debug', 'info', 'warn', 'error'];

before(() => {
  for (let l of levels)
    if (!console[l].restore)
      sinon.stub(console, l);
})

beforeEach(() => {
  for (let l of levels)
    console[l].reset();
})


after(() => {
  for (let l of levels)
    console[l].restore();
})
