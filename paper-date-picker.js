Polymer("paper-date-picker", {
  once: function(obj, eventName, callback) {
    var doCallback = function() {
      callback.apply(obj, arguments);
      obj.removeEventListener(eventName, doCallback);
    };
    obj.addEventListener(eventName, doCallback);
  },
  publish: {
    locale: null,
    minYear: null,
    maxYear: null,
    showHeading: true,
    narrow: {type: 'boolean', value: false, reflect: true},
    isTouch: {type: 'boolean', value: false, reflect: true}
  },
  dateClicked: function(e) {
    var element = e.originalTarget ? e.originalTarget : e.toElement;
  },
  ready: function() {
    this.today = this.$.calendar.today;
    this.isTouch = 'ontouchstart' in window;
    this.narrow = false;
    this.localeChanged();
    this.headingDate = this.value ? this.value : new Date();
    this.years = this.$.calendar.years;

    // track page transitions
    this.$.pages.addEventListener('core-animated-pages-transition-prepare', function() {
      this._pageTransitioning = true;
    });
    this.$.pages.addEventListener('core-animated-pages-transition-end', function() {
      this._pageTransitioning = false;
    });
  },
  tapHeadingDay: function() {
    if (this.$.pages.selected !== 0) {
      this.selectPage(0, function() {
        this.$.calendar.scrollToDate(this.headingDate);
      }.bind(this));
    } else {
      this.$.calendar.scrollToDate(this.headingDate);
    }
  },
  tapHeadingMonth: function() {
    this.tapHeadingDay();
  },
  tapHeadingYear: function() {
    var year = this.headingDate.getFullYear();
    this.scrollYearList(year);
    this.selectPage(1);
  },
  selectPage: function(page, callback) {
    if (this._pageTransitioning) return;
    if (callback) {
      this.once(this.$.pages, 'core-animated-pages-transition-end', callback);
    }
    this.$.pages.selected = page;
  },
  scrollYearList: function(year, cb) {
    this.async(function() {
      var idx = year - this.startYear;
      this.$.yearList.scrollToItem(idx);
      this.$.yearList.scrollTop -= 94;
      if(cb) cb();
    });
  },
  dateSelected: function(e, detail) {
    this.value = detail.date;
  },
  valueChanged: function(oldValue, newValue) {
    if (newValue) {
      this.headingDate = newValue;
    } else {
      this.headingDate = this.today;
    }
  },
  // attributes that propagate to paper-calendar
  localeChanged: function() {
    moment.locale(this.locale);
    this.$.calendar.locale = this.locale;
  },
  minYearChanged: function() {
    this.$.calendar.minYear = this.minYear;
  },
  maxYearChanged: function() {
    this.$.calendar.maxYear = this.maxYear;
  }
});
