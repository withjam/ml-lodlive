// Karma configuration
// Generated on Wed Oct 14 2015 12:50:33 GMT-0400 (EDT)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['mocha', 'chai', 'sinon', 'fixture', 'browserify'],


    // list of files / patterns to load in the browser
    files: [
      'node_modules/jquery/dist/jquery.js',
      'node_modules/sinon-chai/lib/sinon-chai.js',
      'src/*.js',
      'js/deps/*.js',
      'js/lib/*.js',
      'js/profile/profile.example.js',
      'test/**/*.js',
      'test/fixtures/*.json'
    ],


    // list of files to exclude
    exclude: [],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'js/lib/*.js': ['coverage'],
      'js/lib/lodlive.core.js': ['browserify'],
      'src/*.js': ['coverage', 'browserify'],
      '**/*.json': ['json_fixtures']
    },


    browserify: {
      debug: true,
      transform: [ 'browserify-istanbul' ]
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', 'coverage'],


    coverageReporter: {
      reporters: [
        // enable this once there's some moderate level of coverage ;)
        // { type : 'text-summary' },
        { type : 'lcov', dir : 'coverage/' }
      ]
    },


    jsonFixturesPreprocessor: {
      variableName: '__json__'
    },


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['PhantomJS'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true
  })
}
