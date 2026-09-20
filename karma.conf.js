// The layout specs measure real geometry, and styles.css has a `max-width: 767.98px`
// breakpoint. ChromeHeadless defaults to an 800x600 window, which is 749px of usable
// viewport once karma's own chrome is subtracted — below the breakpoint, so the "desktop"
// specs were silently running the phone layout. Pin the window wide enough that a media
// query keyed off the viewport agrees with the widths those specs fake per-element.
module.exports = function (config) {
  config.set({
    // Supplying a karma config at all drops the builder's own defaults, so the
    // jasmine framework and its plugin have to be named here too.
    frameworks: ['jasmine'],
    plugins: [require('karma-jasmine'), require('karma-chrome-launcher')],
    browsers: ['ChromeHeadlessDesktop'],
    customLaunchers: {
      ChromeHeadlessDesktop: {
        base: 'ChromeHeadless',
        flags: ['--window-size=1400,1000'],
      },
    },
  });
};
