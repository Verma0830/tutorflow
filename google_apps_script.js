/**
 * TutorFlow Google Sheets Database Sync Script
 * 
 * Instructions:
 * 1. Create a new Google Sheet in Google Drive.
 * 2. Rename the default sheet (tab) to "Students".
 * 3. Create two more sheets (tabs) and name them "Attendance" and "Fees".
 * 4. In the Google Sheet, go to Extensions -> Apps Script.
 * 5. Delete any code in the editor and paste this code.
 * 6. Click Save (floppy disk icon).
 * 7. Click Deploy -> New deployment.
 * 8. Choose type: Web app.
 * 9. Set:
 *    - Description: TutorFlow DB Sync
 *    - Execute as: Me (your email)
 *    - Who has access: Anyone
 * 10. Click Deploy, authorize permissions, and copy the "Web app URL" (ends in "/exec").
 * 11. Paste this URL in your app's Settings or code!
 */

function doGet(e) {
  var sheets = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Students
  var studentSheet = sheets.getSheetByName("Students");
  var students = [];
  if (studentSheet) {
    var data = studentSheet.getDataRange().getValues();
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        students.push({
          id: parseInt(data[i][0]) || i,
          name: String(data[i][1]).trim(),
          class: String(data[i][2]).trim(),
          fees: parseFloat(data[i][3]) || 0,
          joiningDate: data[i][4] ? formatDate(data[i][4]) : ""
        });
      }
    }
  }
  
  // 2. Get Attendance
  var attendanceSheet = sheets.getSheetByName("Attendance");
  var attendance = {};
  if (attendanceSheet) {
    var data = attendanceSheet.getDataRange().getValues();
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var dateStr = formatDate(data[i][0]);
        var studentId = String(data[i][1]).trim();
        var status = String(data[i][2]).trim().toLowerCase();
        
        if (dateStr && studentId && status) {
          if (!attendance[dateStr]) attendance[dateStr] = {};
          attendance[dateStr][studentId] = status;
        }
      }
    }
  }
  
  // 3. Get Fees
  var feesSheet = sheets.getSheetByName("Fees");
  var fees = {};
  if (feesSheet) {
    var data = feesSheet.getDataRange().getValues();
    if (data.length > 1) {
      for (var i = 1; i < data.length; i++) {
        var monthStr = String(data[i][0]).trim(); // "YYYY-MM"
        var studentId = String(data[i][1]).trim();
        var isPaid = data[i][2] === true || String(data[i][2]).toLowerCase() === "true" || data[i][2] === 1;
        
        if (monthStr && studentId) {
          if (!fees[monthStr]) fees[monthStr] = {};
          fees[monthStr][studentId] = isPaid;
        }
      }
    }
  }
  
  var payload = {
    students: students,
    attendance: attendance,
    fees: fees
  };
  
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action;
    var sheets = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "sync_all") {
      // Overwrite Students sheet
      var studentSheet = getOrCreateSheet(sheets, "Students");
      studentSheet.clear();
      studentSheet.appendRow(["id", "name", "class", "fees", "joiningDate"]);
      var studentRows = requestData.students;
      if (studentRows && studentRows.length > 0) {
        var rows = studentRows.map(function(s) {
          return [s.id, s.name, s.class, s.fees, s.joiningDate];
        });
        studentSheet.getRange(2, 1, rows.length, 5).setValues(rows);
      }
      
      // Overwrite Attendance sheet
      var attendanceSheet = getOrCreateSheet(sheets, "Attendance");
      attendanceSheet.clear();
      attendanceSheet.appendRow(["date", "studentId", "status"]);
      var attData = requestData.attendance;
      var attRows = [];
      if (attData) {
        for (var dateKey in attData) {
          for (var sId in attData[dateKey]) {
            attRows.push([dateKey, sId, attData[dateKey][sId]]);
          }
        }
        if (attRows.length > 0) {
          attendanceSheet.getRange(2, 1, attRows.length, 3).setValues(attRows);
        }
      }
      
      // Overwrite Fees sheet
      var feesSheet = getOrCreateSheet(sheets, "Fees");
      feesSheet.clear();
      feesSheet.appendRow(["month", "studentId", "isPaid"]);
      var feeData = requestData.fees;
      var feeRows = [];
      if (feeData) {
        for (var monthKey in feeData) {
          for (var sId in feeData[monthKey]) {
            feeRows.push([monthKey, sId, feeData[monthKey][sId]]);
          }
        }
        if (feeRows.length > 0) {
          feesSheet.getRange(2, 1, feeRows.length, 3).setValues(feeRows);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Full database synced successfully!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "update_attendance") {
      var dateVal = requestData.date;
      var studentIdVal = String(requestData.studentId).trim();
      var statusVal = String(requestData.status).trim().toLowerCase();
      
      var attendanceSheet = getOrCreateSheet(sheets, "Attendance");
      var data = attendanceSheet.getDataRange().getValues();
      var foundRow = -1;
      
      for (var i = 1; i < data.length; i++) {
        var rowDate = formatDate(data[i][0]);
        var rowStudentId = String(data[i][1]).trim();
        if (rowDate === dateVal && rowStudentId === studentIdVal) {
          foundRow = i + 1; // 1-based index
          break;
        }
      }
      
      if (statusVal === "") {
        // Delete record if status cleared
        if (foundRow !== -1) {
          attendanceSheet.deleteRow(foundRow);
        }
      } else {
        if (foundRow !== -1) {
          // Update status
          attendanceSheet.getRange(foundRow, 3).setValue(statusVal);
        } else {
          // Add new record
          attendanceSheet.appendRow([dateVal, studentIdVal, statusVal]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "update_fee") {
      var monthVal = requestData.month;
      var studentIdVal = String(requestData.studentId).trim();
      var isPaidVal = requestData.isPaid;
      
      var feesSheet = getOrCreateSheet(sheets, "Fees");
      var data = feesSheet.getDataRange().getValues();
      var foundRow = -1;
      
      for (var i = 1; i < data.length; i++) {
        var rowMonth = String(data[i][0]).trim();
        var rowStudentId = String(data[i][1]).trim();
        if (rowMonth === monthVal && rowStudentId === studentIdVal) {
          foundRow = i + 1;
          break;
        }
      }
      
      if (foundRow !== -1) {
        feesSheet.getRange(foundRow, 3).setValue(isPaidVal);
      } else {
        feesSheet.appendRow([monthVal, studentIdVal, isPaidVal]);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatDate(dateObj) {
  if (!dateObj) return "";
  if (dateObj instanceof Date) {
    var yyyy = dateObj.getFullYear();
    var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    var dd = String(dateObj.getDate()).padStart(2, '0');
    return yyyy + "-" + mm + "-" + dd;
  }
  
  var dateStr = String(dateObj).trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Check if string contains standard timestamp format
  if (dateStr.indexOf("T") !== -1) {
    return dateStr.substring(0, 10);
  }
  
  // Handle "Mon Jul 06" or "Jul 06" (text dates without year - default to current year)
  var monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
  };
  
  // Match "Mon Jul 06" or "Mon Jul 6" or "Jul 06"
  var textMatch = dateStr.match(/(?:[A-Za-z]+\s+)?([A-Za-z]{3})\s+(\d{1,2})$/);
  if (textMatch) {
    var monthName = textMatch[1].toLowerCase();
    var day = textMatch[2].padStart(2, '0');
    var monthNum = monthMap[monthName];
    if (monthNum) {
      var year = new Date().getFullYear();
      return year + "-" + monthNum + "-" + day;
    }
  }
  
  // Match "Mon Jul 06 2026" or "Jul 06 2026"
  var textYearMatch = dateStr.match(/(?:[A-Za-z]+\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
  if (textYearMatch) {
    var monthName = textYearMatch[1].toLowerCase();
    var day = textYearMatch[2].padStart(2, '0');
    var year = textYearMatch[3];
    var monthNum = monthMap[monthName];
    if (monthNum) {
      return year + "-" + monthNum + "-" + day;
    }
  }
  
  // Parse date string as final fallback
  var d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + "-" + mm + "-" + dd;
  }
  return dateStr;
}
