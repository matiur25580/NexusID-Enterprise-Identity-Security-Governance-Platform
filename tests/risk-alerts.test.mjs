import test from "node:test";import assert from "node:assert/strict";import {detectRiskEscalations} from "../apps/web/lib/risk-alerts.ts";const risk=score=>({score});
test("critical threshold crossing",()=>assert.deepEqual(detectRiskEscalations(70,risk(80)).map(x=>x.alertType),["CRITICAL_THRESHOLD"]));
test("material score increase",()=>assert.deepEqual(detectRiskEscalations(20,risk(40)).map(x=>x.alertType),["RISK_SPIKE"]));
test("both signals can apply",()=>assert.deepEqual(detectRiskEscalations(50,risk(80)).map(x=>x.alertType),["CRITICAL_THRESHOLD","RISK_SPIKE"]));
test("stable or decreasing score creates no alert",()=>assert.deepEqual(detectRiskEscalations(60,risk(55)),[]));
test("first critical assessment is flagged",()=>assert.equal(detectRiskEscalations(null,risk(75))[0].alertType,"CRITICAL_THRESHOLD"));