setTimeout(() => {
  if (global.config === undefined || global.network === undefined) {
    process.exit(123);
  }
}, 100);
