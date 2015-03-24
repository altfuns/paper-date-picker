Polymer("paper-calendar", {
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
    initialMonth: null,
    isTouch: {type: 'boolean', value: false, reflect: true}
  },
  localeChanged: function() {
    moment.locale(this.locale);
  },
  dateClicked: function(e) {
    var element = e.originalTarget ? e.originalTarget : e.toElement;
  },
  ready: function() {
    this.selectedDate = null;
    this.isTouch = 'ontouchstart' in window;
    this.months = [];
    this.years = [];
    this.today = new Date();
    this._physicalMonths = [];
    this.initialDate = this.initialDate ? this.initialDate : this.today;
    this.today.setHours(0, 0, 0, 0);
    this.weekdays = moment.weekdays();
    this.monthNames = moment.months();
    this.localeChanged();
    this.startYear = this.startYear ? this.startYear : 1900;
    this.endYear = this.endYear ? this.endYear : 2100;
    this.populateCalendar(this.initialDate.getFullYear());

    // monitor calendarList for mutations
    this._boundCalendarListMutationCallback = this.calendarListUpdated;
    this.onMutation(this.$.calendarList, this._boundCalendarListMutationCallback);

    this.scrollToDate(this.initialDate);
  },
  populateCalendar: function(year) {
    var month, days, day, date = new Date();
    var thisYear = this.today.getFullYear();
    var thisMonth = this.today.getMonth();
    var thisDay = this.today.getDate();

    date.setYear(year);
    for (month=0; month<12; month++) {
      // days are split into weeks
      days = [[]];
      day = 1;
      date.setMonth(month);
      date.setDate(1);
      
      // add "padding" days
      for (d=0; d<date.getDay(); d++) {
        days[0].push({day: null});
      }

      // add actual days 
      while (date.getMonth() == month) {
        if (d % 7 == 0) {
          // start new week
          days.push([]);
        }
        days[days.length-1].push({
          name: year + '-' + (month+1) + '-' + day,
          year: year,
          month: month,
          day: day,
          isToday: year == thisYear && month == thisMonth && day == thisDay
        });
        date.setDate(++day);
        d++;
      }
      monthData = {
        year: year,
        month: month,
        days: days,
        domReady: false
      };
      this.months.push(monthData);
    }
  },
  getMonthIdx: function(year, month) {
    var yearDiff = (year - this.months[0].year);
    var monthDiff = (month - this.months[0].month);
    return (yearDiff * 12) + monthDiff;
  },
  calendarListUpdated: function(observer, mutations) {
    this.fire('calendar-updated');
    if (this._scrollToMonth) {
      this._scrollToMonth();
    }
  },
  scrollToMonth: function(year, month) {
    this._scrollToMonth = null;
    var el = this.querySelector('month-' + year + '-' + month);
    if (el) {
      debugger;
      this.$.calendarList.scrollTop = el.offsetTop;
    } else {
      this._scrollToMonth = this.scrollToMonth.bind(this, year, month);
    }
  },
  scrollToDate: function(date) {
    if (!date) {
      date = this.initialDate;
    }
    this.scrollToMonth(date.getFullYear(), date.getMonth());
  },
  dateSelected: function(event, details) {
    var dateStr = details.item.getAttribute('name');
    this.selectedDate = new Date(dateStr);
    this.fire('date-select', {date: this.selectedDate}, this);
  },
  _getDayName: function(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  },
});
