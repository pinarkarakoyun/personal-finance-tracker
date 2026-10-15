// Turns "2026-10" into { start: '2026-10-01', end: '2026-11-01' }.
// Returns null if the input is not a valid YYYY-MM month.
function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }
  const [year, mon] = month.split('-').map(Number);
  if (year < 1900 || year > 2200) {
    return null;
  }
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMon).padStart(2, '0')}-01`,
  };
}

module.exports = { monthRange };