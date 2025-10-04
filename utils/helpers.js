const moment = require("moment");
function addDays(days) {
  return moment().add(moment.duration(days, "days"));
}
function dayAfter(timestamp) {
  return moment().isAfter(timestamp);
}
function getCurrentSeason() {
  const date = new Date();
  const month = date.getMonth() + 1; // Months are 0-indexed in JS
  const day = date.getDate();
  // Determine the season based on month and day
  if (
    (month === 3 && day >= 20) ||
    month === 4 ||
    month === 5 ||
    (month === 6 && day < 21)
  ) {
    return "SPRING";
  } else if (
    (month === 6 && day >= 21) ||
    month === 7 ||
    month === 8 ||
    (month === 9 && day < 23)
  ) {
    return "SUMMER";
  } else if (
    (month === 9 && day >= 23) ||
    month === 10 ||
    month === 11 ||
    (month === 12 && day < 21)
  ) {
    return "FALL";
  } else {
    return "WINTER";
  }
}
function getCurrentDate(){
  return moment().format('DD-mm-yyyy')
}
module.exports = {
  getCurrentDate,
  dayAfter,
  addDays,
  getCurrentSeason
};
