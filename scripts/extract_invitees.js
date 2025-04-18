"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var XLSX = require("xlsx");
var csv_writer_1 = require("csv-writer");
var DATA_DIR = path.join(__dirname, '../data/previous_registrations');
var OUTPUT_FILE = path.join(__dirname, '../data/invite_list.csv');
// Keywords to identify the opt-in column
var OPTIN_KEYWORDS = ['notify', 'future', 'inform', 'send info'];
function findOptInColumn(headers) {
    return headers.find(function (h) { return OPTIN_KEYWORDS.some(function (kw) { return h.toLowerCase().includes(kw); }); });
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var files, invitees, _i, files_1, file, yearMatch, year, workbook, sheetName, sheet, rows, headers, optInCol, emailCol, nameCol, _a, rows_1, row, optedIn, uniqueInvitees, csvWriter;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    files = fs.readdirSync(DATA_DIR).filter(function (f) { return f.endsWith('.xlsx'); });
                    invitees = [];
                    for (_i = 0, files_1 = files; _i < files_1.length; _i++) {
                        file = files_1[_i];
                        yearMatch = file.match(/(\d{4})/);
                        year = yearMatch ? yearMatch[1] : '';
                        workbook = XLSX.readFile(path.join(DATA_DIR, file));
                        sheetName = workbook.SheetNames[0];
                        sheet = workbook.Sheets[sheetName];
                        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                        if (rows.length === 0)
                            continue;
                        headers = Object.keys(rows[0]);
                        optInCol = findOptInColumn(headers);
                        emailCol = headers.find(function (h) { return h.toLowerCase().includes('mail'); });
                        nameCol = headers.find(function (h) { return h.toLowerCase().includes('navn') || h.toLowerCase().includes('name'); });
                        if (!optInCol || !emailCol || !nameCol) {
                            console.warn("Could not find columns in ".concat(file, ". Skipping."));
                            continue;
                        }
                        for (_a = 0, rows_1 = rows; _a < rows_1.length; _a++) {
                            row = rows_1[_a];
                            optedIn = (row[optInCol] || '').toString().toLowerCase();
                            if (optedIn.includes('yes') || optedIn.includes('ja')) {
                                invitees.push({
                                    name: row[nameCol],
                                    email: normalizeEmail(row[emailCol]),
                                    year: year
                                });
                            }
                        }
                    }
                    uniqueInvitees = Object.values(invitees.reduce(function (acc, cur) {
                        acc[cur.email] = cur;
                        return acc;
                    }, {}));
                    csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
                        path: OUTPUT_FILE,
                        header: [
                            { id: 'name', title: 'Name' },
                            { id: 'email', title: 'Email' },
                            { id: 'year', title: 'Year' }
                        ]
                    });
                    return [4 /*yield*/, csvWriter.writeRecords(uniqueInvitees)];
                case 1:
                    _b.sent();
                    console.log("Extracted ".concat(uniqueInvitees.length, " invitees to ").concat(OUTPUT_FILE));
                    return [2 /*return*/];
            }
        });
    });
}
main()["catch"](function (e) {
    console.error('Error extracting invitees:', e);
    process.exit(1);
});
