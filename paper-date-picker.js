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
    '$.yearList._viewportSize': '_setYearListReady',
  },
  localeChanged: function() {
    moment.locale(this.locale);
  },
  dateClicked: function(e) {
    var element = e.originalTarget ? e.originalTarget : e.toElement;
  },
  ready: function() {
    this.fps = 60;
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

    this.debug = {raf: []};

    this._monthIdx = 0;

    // Create nodes for use in RAF
    this.$.rafNodes.$ = rafNodes;
    this._monthNodes = this.$.calendarList.querySelectorAll('.month');
    this._scrollerHeight = this.$.calendarListScroller.offsetHeight;

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
    this._dayWidth = dayWidth;
    this._daysOffset = daysOffset;
    this._monthPadding = padding;
    this._titleHeight = titleHeight;

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

    this._scroller = this.$.chooseDay;
    this._virtualScrollTop = 0;
    this._viewportHeight = this.$.calendarList.offsetHeight;
    this._scrollerEnd = this._scrollerHeight - this._viewportHeight;
    // position the scroller to have equal runway above and below
    this._initialOffset = (this._scrollerHeight / 2) - (this._viewportHeight / 2);
    this._scroller.scrollTop = this._initialOffset;
    this._scrollTop = this._scroller.scrollTop;
    this._virtualOffset = 0 - this._initialOffset;
    this._lastTimestamp = 0;

    // Set the scroll handler
    this._boundRAFHandler = this.updateMonthScroller.bind(this);
    this._scrolling = false;
    var _boundScrollHandler = this.scrollHandler.bind(this);
    this._scroller.addEventListener('scroll', _boundScrollHandler);

    this.updateMonthScroller();
  },
  scrollHandler: function() {
    var scroller = this._scroller;
    var offset = this._virtualOffset;
    var scrollTop = scroller.scrollTop;
    var scrollerEnd = this._scrollerEnd;

    // reset scroller offset when runway reaches the end
    if (scrollTop >= scrollerEnd || scrollTop <= 0) {
      // we're about to set scrollTop back to initialOffset, so capture the
      // difference to add to the virtual offset.
      var initialOffset = this._initialOffset;
      offset += (scrollTop - initialOffset);
      scrollTop = initialOffset;
      scroller.scrollTop = scrollTop;
      this._virtualOffset = offset;
      this.resetLayout();
    }

    var virtualTop = scrollTop + offset;
    this._scrollTop = scrollTop;
    this._virtualScrollTop = virtualTop;
    this._monthIdx = this.getScrollMonth(virtualTop);

    // offload layout onto RAF
    if (!this._scrolling) {
      requestAnimationFrame(this._boundRAFHandler);
    }
    this._scrolling = true;
    this.fire('paper-date-picker-scroll');
  },
  updateMonthScroller: function(timestamp) {
    // WARNING: runs in RAF, do not trigger reflows or unecessary repaints
    // Get first month that would show in the viewport
    if (!timestamp) timestamp = 0;

    var deltaMin = 1000 / this.fps;
    var lastTimestamp = this._lastTimestamp;
    var delta = timestamp - lastTimestamp;

    this._lastTimestamp = timestamp;
    this._scrollerFPS = (1 / delta * 1000);

    if (lastTimestamp && delta < deltaMin) {
      //TODO (limit fps): return;
    }

    // reset this._scrolling so that we can capture the next onScroll
    this._scrolling = false;

    // lay out each month that comes into view
    var idx = this._monthIdx;
    while (this.months[idx].top < this._virtualScrollTop + this._viewportHeight) {
      this.layoutMonth(idx);
      idx++;
    }
  },
  resetLayout: function() {
    // move all nodes out of viewport
    var nodes = Object.keys(this.$.rafNodes.$);
    var rafNodes = this.$.rafNodes.$;
    for (var i=0; i<nodes.length; i++) {
      rafNodes[nodes[i]].style.top = '-1000px';
    }
  },
  layoutMonth: function(monthIdx) {
    // WARNING: runs in RAF, do not trigger reflows or unecessary repaints
    var rafNodes = this.$.rafNodes.$;
    var month = this.months[monthIdx];
    var n = monthIdx % 2;
    var rafMonth = rafNodes['raf' + n + 'Month'];
    var offset = this._virtualOffset;
    var vpTop = this._scrollTop;
    var vpBottom = vpTop + this._viewportHeight;
    var titleMonth = rafNodes['rafMonthName' + month.name];
    var titleYear = rafNodes['raf' + n + 'Year' + month.year];
    var top = month.top - offset;
    var topPx = top + 'px';
    var padding = this._monthPadding;
    var dayHeight = this._dayHeight;
    var dayWidth = this._dayWidth;
    var dayTop = top + this._daysOffset;
    var dayLeft = padding;
    var startOn = month.startOn;
    var numDays = month.numDays;

    // TODO: This is broken now, because we're jumping the scroll area back and
    // forth, and artifact elements are not moved out of sight

    if (n === 0) {
      this.debug = {
        n: n,
        viewportTop: vpTop,
        top: top,
        viewortBottom: vpBottom,
        monthTop: month.top,
        positionHeader: 'no',
        titleMonth: titleMonth.innerHTML
      };
    }

    // position the header
    var cell, col, row, rowTop;
    if (vpTop <= top && top < vpBottom) {
      rafMonth.style.top = topPx;
      titleMonth.style.top = topPx;
      titleYear.style.top = topPx;
      titleMonth.style.left = month.nameLeft + 'px';
      titleYear.style.left = month.yearLeft + 'px';
    }

    // position days
    for (var i=0; i<numDays; i++) {
      cell = startOn + i;
      col = cell % 7;
      row = Math.floor(cell / 7);
      rowTop = dayTop + (row * dayHeight);
      // only move the day if the target position is in the viewport
      if (vpTop <= rowTop && rowTop < vpBottom) {
        day = rafNodes['raf' + n + 'Day' + (i+1)]; 
        day.style.top = rowTop + 'px';
        day.style.left = padding + (col * dayWidth) + 'px';
      }
    }
  },
  getScrollMonth: function(pos) {
    // get the first month that is visible at the given position
    var idx, top, bottom, month;
    var titleHeight = this._titleHeight;
    var dayHeight = this._dayHeight;
    min = Math.floor(pos / ((dayHeight * 6) + titleHeight));
    max = Math.ceil(pos / ((dayHeight * 4) + titleHeight));
    while (min <= max) {
      idx = (min + max) / 2 | 0;
      month = this.months[idx];
      top = month.top;
      bottom = top + month.height;
      if (bottom > pos && top <= pos) {
        return idx;
      } else if (bottom < pos) {
        min = idx + 1;
      } else {
        max = idx - 1;
      }
    }
    console.error("Could not find month at position: ", pos);
    return -1;
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
    var d = this.selectedDate;
    this.value = new Date(d.year, d.month, d.day);
  },
  selectedYearChanged: function(oldValue, newValue) {
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
