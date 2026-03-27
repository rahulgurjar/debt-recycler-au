const superagent = require('superagent');
const binaryParser = require('superagent/lib/node/parsers/image');
superagent.parse['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] = binaryParser;

// Patch ExcelJS color parsing to expose rgb alongside argb
const ColorXform = require('exceljs/lib/xlsx/xform/style/color-xform');
const origColorParseOpen = ColorXform.prototype.parseOpen;
ColorXform.prototype.parseOpen = function(node) {
  const result = origColorParseOpen.call(this, node);
  if (this.model && this.model.argb) {
    this.model.rgb = this.model.argb;
  }
  return result;
};

// Patch ExcelJS SheetView parsing to expose pane sub-object for frozen views
const SheetViewXform = require('exceljs/lib/xlsx/xform/sheet/sheet-view-xform');
const origSheetViewParseClose = SheetViewXform.prototype.parseClose;
SheetViewXform.prototype.parseClose = function(name) {
  const result = origSheetViewParseClose.call(this, name);
  if (this.model && this.model.state === 'frozen') {
    this.model.pane = { ySplit: this.model.ySplit, xSplit: this.model.xSplit, topLeftCell: this.model.topLeftCell, state: 'frozen' };
  }
  return result;
};
