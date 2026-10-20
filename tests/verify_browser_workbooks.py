"""Independent read-only checks of actual browser downloads; requires openpyxl."""
from pathlib import Path
import json
import openpyxl
root=Path(__file__).resolve().parents[1]
folder=root/'docs/phase5-browser'
checks=[]
for name,total,budget in [('approval-baseline.xlsx',29525000,475000),('approval-changed.xlsx',29750000,-750000)]:
    values=openpyxl.load_workbook(folder/name,data_only=True)
    formulas=openpyxl.load_workbook(folder/name,data_only=False)
    assert values.sheetnames==['예산 집행 승인 요청서','노무비 산출 상세','시나리오 비교','계산 근거 및 가정']
    request=values.worksheets[0]
    assert request['B14'].value==total and request['B15'].value==budget
    assert request['B10'].value=='기존 인원 OT 3h'
    assert all(request[f'B{i}'].value in [None,''] for i in range(18,23))
    assert all(sheet.freeze_panes=='A2' for sheet in values.worksheets)
    assert formulas.worksheets[1]['G2'].value=='=E2*F2'
    detail=values.worksheets[1]
    assert detail.cell(detail.max_row,12).value==total
    selected=next(row for row in values.worksheets[2].iter_rows(min_row=2,values_only=True)if row[0]=='A2')
    assert selected[8]==total and selected[9]==budget
    checks.append({'file':name,'total':total,'budgetRemaining':budget,'fourSheets':True,'formulasAndCachedTotals':True,'blankApprovals':True})
history=openpyxl.load_workbook(folder/'inspection-history.xlsx',data_only=True)
assert history.active.max_row==1201
summary=openpyxl.load_workbook(folder/'quality-summary.xlsx',data_only=True)
assert (summary.active['C2'].value,summary.active['D2'].value,summary.active['F2'].value)==(1200,72,54)
output={'budgetExports':checks,'historyRecordCount':history.active.max_row-1,'summary12M':{'inspections':1200,'failures':72,'reworks':54}}
(root/'docs/verification/v5-browser-workbooks.json').write_text(json.dumps(output,indent=2,ensure_ascii=False))
print('PASS: browser ExcelJS exports, current budgets, formulas, four sheets, blank approvals, 1200 historical records')
