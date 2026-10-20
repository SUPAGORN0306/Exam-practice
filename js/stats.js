/* Basic stats helpers — round 1 */
(function () {
  window.App = window.App || {};

  function todayKey() {
    // Local time minus DAY_START_HOUR
    var d = new Date(Date.now() - 4 * 60 * 60 * 1000);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function median(nums) {
    if (!nums.length) return 0;
    var sorted = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  App.stats = {
    todayKey: todayKey,
    median: median
  };
})();