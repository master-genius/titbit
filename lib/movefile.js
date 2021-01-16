'use strict';

const fs = require('fs');

module.exports = async (ctx, upf, target) => {
  let fd = await new Promise((rv, rj) => {
    fs.open(target, 'w+', 0o644, (err, fd) => {
      if (err) {
        rj(err);
      } else {
        rv(fd);
      }
    });
  });

  return new Promise((rv, rj) => {
    fs.write(fd, ctx.rawBody, upf.start, upf.length, 
      (err, bytesWritten, buffer) => {
        if (err) {
          rj(err);
        } else {
          rv(bytesWritten);
        }
      });
  })
  .finally(() => {
    fs.close(fd, (err) => {});
  });
  
};
