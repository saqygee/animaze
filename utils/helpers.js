const moment = require('moment');
function addDays(days){
  return moment().add(moment.duration(days,'days'));
}
function dayAfter(timestamp){
  return moment().isAfter(timestamp);
}

module.exports = {
  dayAfter,
  addDays
};
