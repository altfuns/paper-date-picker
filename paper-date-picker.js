(function() {

var $ = function(e){
  return e.querySelector ? e.querySelector.bind(e) : document.querySelector(e);
};

Polymer("paper-date-picker", {
  once: function(obj, eventName, callback) {
    var doCallback = function() {
      callback.apply(obj, arguments);
      obj.removeEventListener(eventName, doCallback);
    };
    obj.addEventListener(eventName, doCallback);
  },
  publish: {
    locale: '',
    showHeading: true,
    narrow: {type: 'boolean', value: false, reflect: true},
  },
  observe: {
    '$.calendarList._viewportSize': '_setCalendarReady',
    '$.yearList._viewportSize': '_setYearListReady',
  },
  localeChanged: function() {
    moment.locale(this.locale);
  },
  dateClicked: function(e) {
    var element = e.originalTarget ? e.originalTarget : e.toElement;
  },
  ready: function() {
    this.months = [];
    this.years = [];
    this.today = new Date();
    this.today.setHours(0, 0, 0, 0);
    this.narrow = false;
    this.weekdays = moment.weekdays();
    this.monthNames = moment.months();
    this.isTouch = 'ontouchstart' in window;
    this.localeChanged();
    this.startYear = this.startYear || this.today.getFullYear();
    this.endYear = this.endYear || this.today.getFullYear() + 20;
    this.totalWeekRows = 0;
    this.populateCalendar();
    this.headingDate = this.value ? this.value : new Date();

    this.rafSets = [0, 1];
    var rafDays = [];
    for (var i=1; i<=31; i++) {
      rafDays.push(i);
    }
    this.rafDays = rafDays;

    // track page transitions
    this.$.pages.addEventListener('core-animated-pages-transition-prepare', function() {
      this._pageTransitioning = true;
    });
    this.$.pages.addEventListener('core-animated-pages-transition-end', function() {
      this._pageTransitioning = false;
    });
  },
  domReady: function() {
    this.initScroller();
  },
  populateCalendar: function() {
    // popluates the calendar data for all months in memory
    var year, yearInfo, month, weekRows, startOn, day;
    var top = 0;
    var date = new Date();
    var thisYear = this.today.getFullYear();
    var thisMonth = this.today.getMonth();
    var thisDay = this.today.getDate();

    for (year=this.startYear; year<=this.endYear; year++) {
      yearInfo = {year: year};
      this.years.push(yearInfo);

      date.setYear(year);
      for (month=0; month<12; month++) {
        day = 1;

        // get starting weekday
        date.setMonth(month);
        date.setDate(1);
        startOn = date.getDay();
        
        // get number of days
        date.setMonth(month + 1);
        date.setDate(0);
        numDays = date.getDate();

        weekRows = Math.ceil(numDays / 7);
        var days = [];
        for (var i=0; i<numDays; i++) {
          days.push(i+1);
        }

        monthData = {
          yearInfo: yearInfo,
          year: year,
          month: month,
          name: this.monthNames[month],
          startOn: startOn,
          numDays: numDays,
          days: days,
          rows: weekRows,
          totalRows: this.totalWeekRows
        };
        this.months.push(monthData);
        this.totalWeekRows += weekRows;
      }
    }
  },
  initScroller: function() {
    var i, j, id;
    var rafSets = 2;
    var rafNodes = {};

    this._monthIdx = 0;

    // Create nodes for use in RAF
    this.$.rafNodes.$ = rafNodes;
    this._monthNodes = this.$.calendarList.querySelectorAll('.month');
    this._initialViewportSize = this.$.calendarListViewPort.offsetHeight;

    var mapId = function(id, sets) {
      var n = sets === false ? 1 : rafSets;
      var rafId;
      for (var i=0; i<n; i++) {
        rafId = 'raf' + (sets === false ? id : i + id);
        rafNodes[rafId] = this.$.rafNodes.querySelector('#' + rafId);
      }
    }.bind(this);

    mapId('Month');
  
    for (i=1; i<=31; i++) {
        mapId('Day' + i);
    }

    var monthNameWidths = {};
    for (i=0; i<12; i++) {
      id = 'MonthName' + this.monthNames[i];
      mapId(id, false);
      monthNameWidths[i] = rafNodes['raf' + id].offsetWidth;
    }

    for (i=0; i<this.years.length; i++) {
      var y = this.years[i];
      id = 'Year' + y.year;
      mapId(id);
      y.width = rafNodes['raf0Year' + y.year].offsetWidth;
    }

    // calculate dimensions and positioning of month elements
    var calcMonth = rafNodes.raf0Month;
    var calcMonthStyle = getComputedStyle(calcMonth);
    var padding = parseInt(calcMonthStyle.paddingLeft.replace('px', ''));
    var calcTitle = calcMonth.querySelector('.month-title');
    var titleStyle = getComputedStyle(calcTitle);
    var calcDay = rafNodes.raf0Day1;
    var dayHeight = calcDay.offsetHeight;
    var dayWidth = calcDay.offsetWidth;
    var titleHeight = calcTitle.offsetHeight;
    var titleCenter = calcTitle.offsetWidth / 2;
    var daysOffset = titleHeight + calcMonth.querySelector('.month-weekdays').offsetHeight;

    this._dayHeight = dayHeight;
    this._daysOffset = daysOffset;
    this._titleHeight = titleHeight;
    this._dayWidth = dayWidth;
    this._monthPadding = padding;

    var top = 0;
    for (i=0; i<this.months.length; i++) {
      var month = this.months[i];
      var monthNameWidth = monthNameWidths[month.month];
      var titleWidth = monthNameWidth + month.yearInfo.width;
      var nameLeft = titleCenter - (titleWidth / 2);
      month.top = top;
      month.height = daysOffset + (month.rows * dayHeight);
      month.nameLeft = padding + nameLeft;
      month.yearLeft = padding + nameLeft + monthNameWidth;
      top += month.height;
    }

    // Set the RAF handler
    this._boundRAFHandler = this.updateMonthScroller.bind(this);

    // Set the scroll handler
    this._scrolling = false;
    var _boundScrollHandler = this.scrollHandler.bind(this);
    this.$.chooseDay.addEventListener('scroll', _boundScrollHandler);

    this.updateMonthScroller();
  },
  scrollHandler: function() {
    var scrollTop = this.$.chooseDay.scrollTop;
    var viewport = this.$.calendarListViewPort;
    this._monthIdx = this.getMonthAtPosition(scrollTop);
    console.log(scrollTop);
    console.log(this._monthIdx);

    // add more viewport size if needed
    if ((scrollTop + this._initialViewportSize) > viewport.offsetHeight) {
      viewport.offsetHeight += this._initialViewportSize;
    }

    // offload layout onto RAF
    if (!this._scrolling) {
      requestAnimationFrame(this._boundRAFHandler);
    }
    this._scrolling = true;
  },
  getMonthAtPosition: function(pos) {
    var idx,top, bottom;
    // TODO: this could possibly be optimized using some clever math
    min = Math.floor(pos / ((this._dayHeight * 6) + this._titleHeight));
    max = Math.ceil(pos / ((this._dayHeight * 4) + this._titleHeight));
    while (min <= max) {
      idx = (min + max) / 2 | 0;
      top = this.months[idx].top;
      bottom = this.months[idx].height;
      if (bottom < pos) {
        min = idx + 1;
      }
      else if (top > pos + this._viewportHeight) {
        max = idx - 1;
      }
      else {
        return idx;
      }
    }
    return -1;
  },
  updateMonthScroller: function() {
    // WARNING: runs in RAF, do not trigger reflows or unecessary repaints
    // Get first month that would show in the viewport

    // reset this._scrolling so that we can capture the next onScroll
    this._scrolling = false;

    // lay out this month and the next
    this.layoutMonth(0);
    this.layoutMonth(1);
  },
  layoutMonth: function(n) {
    // WARNING: runs in RAF, do not trigger reflows or unecessary repaints
    var rafNodes = this.$.rafNodes.$;
    var month = this.months[this._monthIdx + n];
    var rafMonth = rafNodes['raf' + n + 'Month'];

    // layout title
    var titleMonth = rafNodes['rafMonthName' + month.name];
    var titleYear = rafNodes['raf' + n + 'Year' + month.year];
    var top = month.top;
    var top_px = top + 'px';
    rafMonth.style.top = top_px;
    titleMonth.style.top = top_px;
    titleYear.style.top = top_px;
    titleMonth.style.left = month.nameLeft + 'px';
    titleYear.style.left = month.yearLeft + 'px';

    // layout days
    var padding = this._monthPadding;
    var dayHeight = this._dayHeight;
    var dayWidth = this._dayWidth;
    var dayTop = top + this._daysOffset;
    var dayLeft = padding;
    var startOn = month.startOn;
    var numDays = month.numDays;
    
    var cell, col, row;
    for (var i=0; i<numDays; i++) {
      cell = startOn + i;
      col = cell % 7;
      row = Math.floor(cell / 7);
      day = rafNodes['raf' + n + 'Day' + (i+1)]; 
      day.style.top = dayTop + (row * dayHeight) + 'px';
      day.style.left = padding + (col * dayWidth) + 'px';
    }
  },
  getMonthIdx: function(year, month) {
    var yearDiff = (year - this.months[0].year);
    var monthDiff = (month - this.months[0].month);
    return (yearDiff * 12) + monthDiff;
  },
  tapHeadingDay: function() {
    if (this.$.pages.selected !== 0) {
      this.selectPage(0, function() {
        this.scrollToDate(this.headingDate);
      }.bind(this));
    } else {
      this.scrollToDate(this.headingDate);
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
  scrollToMonth: function(year, month) {
    var idx = this.getMonthIdx(year, month);
    var cal = this.$.calendarList;
    if (!this._calendarReady) {
      this.addEventListener('calendar-ready', function() {
        cal.scrollToItem(idx);
      });
    } else {
      cal.scrollToItem(idx);
    }
  },
  scrollToDate: function(date) {
    if (!date) {
      date = this.value;
    }
    this.scrollToMonth(date.getFullYear(), date.getMonth());
  },
  scrollYearList: function(year, cb) {
    var idx = year - this.startYear;
    if (!this._yearListReady) {
      this.addEventListener('year-list-ready', function() {
        this.$.yearList.scrollToItem(idx);
        this.$.yearList.scrollTop -= 94;
        if(cb) cb();
      }.bind(this));
    } else {
      this.$.yearList.scrollToItem(idx);
      this.$.yearList.scrollTop -= 94;
      if(cb) cb();
    }
  },
  _setCalendarReady: function() {
    if (!this._calendarReady) {
      this._calendarReady = true;
      this.fire('calendar-ready');
    }
  },
  _setYearListReady: function() {
    if (!this._yearListReady) {
      this._yearListReady = true;
      this.fire('year-list-ready');
    }
  },
  selectedDateChanged: function() {
    console.log(arguments);
    var d = this.selectedDate;
    this.value = new Date(d.year, d.month, d.day);
  },
  selectedYearChanged: function(oldValue, newValue) {
    console.log('year changed');
    this.scrollToMonth(this.selectedYear.year, this.headingDate.getMonth());
    if (!oldValue) return;
    if (this.$.pages.selected == 1) {
      this.selectPage(0);
    }
  },
  headingDateChanged: function() {
    if (!this.selectedYear) {
      var idx = this.headingDate.getFullYear() - this.startYear;
      if (!this._yearListReady) {
        this.addEventListener('year-list-ready', function() {
          this.$.yearList.selectItem(idx);
        });
      } else {
        this.$.yearList.selectItem(idx);
      }
    }
  },
  valueChanged: function() {
    console.log('valueChanged: ', this.value);
    this.headingDate = this.value;
    var year = this.value.getFullYear();
    var month = this.value.getMonth();
    var idx = this.getMonthIdx(year, month);
    var monthStart = (new Date(year, month, 1)).getDay();
    //var day = this.days[idx][monthStart + this.value.getDate() - 1];
    if (!this._calendarReady) {
      this.addEventListener('calendar-ready', function() {
        this.$.calendarList.$.selection.select(day);
      });
    } else {
      this.$.calendarList.$.selection.select(day);
    }
  },
});

PolymerExpressions.prototype.dateFormat = function(date, format) {
  if (!date) return '';
  return moment(date).format(format);
};

})();
