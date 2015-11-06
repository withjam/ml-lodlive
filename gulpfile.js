var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var tar = require('gulp-tar');
var gzip = require('gulp-gzip');
var addsrc = require('gulp-add-src');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var source = require('vinyl-source-stream');

gulp.task('deps', function() {
  return gulp.src(['./js/deps/*.js', '!./js/deps/jquery-ui-1.9.2.min.js'])
    .pipe(concat('ml-lodlive.deps.js'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('scripts', function() {
  return browserify({ entries: [ './js/lib/lodlive.core.js' ] }).bundle()
    .pipe(source('ml-lodlive-components.js'))
    .pipe(buffer())
    .pipe(concat('ml-lodlive.js'))
    .pipe(gulp.dest('./dist/'))
    .pipe(uglify())
    .pipe(rename('ml-lodlive.min.js'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('fonts', function() {
  return gulp.src('./css/fonts/**/*')
    .pipe(gulp.dest('./dist/fonts/'));
});

gulp.task('styles', [ 'fonts' ], function() {
  return gulp.src('./css/*.css')
    .pipe(concat('ml-lodlive.all.css'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('build', ['scripts', 'deps', 'styles'], function() {
  return gulp.src(['./dist/ml-lodlive.js', './dist/ml-lodlive.deps.js'])
    .pipe(concat('ml-lodlive.complete.js'))
    .pipe(gulp.dest('./dist/'));
});

gulp.task('package', ['build'], function() {
  return gulp.src(['./dist/ml-lodlive.complete.js', './dist/ml-lodlive.all.css', './dist/fonts/*.*'], { base: './'})
    .pipe(tar('ml-lodlive.tar'))
    .pipe(gzip())
    .pipe(gulp.dest('./'));
});