import { tt } from "./lang";

const MONTHS_KA = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** "26 ოქტომბერი, 2026": done by hand because many browsers lack the Georgian locale. */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${tt(MONTHS_KA[d.getMonth()], MONTHS_EN[d.getMonth()], MONTHS_RU[d.getMonth()])}, ${d.getFullYear()}`;
}

/** "22:29" */
export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
