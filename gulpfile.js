let gulp = require('gulp')
let browserSync = require('browser-sync').create()

function startBrowser (done) {
  browserSync.init({
    server: {
      baseDir: "./example",
      directory: true
    },
    notify: false
  });
  gulp.watch(['example/*/*.html']).on('change', browserSync.reload)
  done()
}
startBrowser.description = 'start a browser-sync'

gulp.task('browser-sync', startBrowser);
gulp.task('default', gulp.series('browser-sync'))