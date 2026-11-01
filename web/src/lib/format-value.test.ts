import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatCurrencyShort, formatInteger, formatIntegerShort, formatShare, formatValue } from "./format-value.ts";

test("moeda completa em pt-BR", () => {
  assert.equal(formatCurrency(1234.5), "R$ 1.234,50");
  assert.equal(formatCurrency(0), "R$ 0,00");
  assert.equal(formatCurrency(-8.9), "-R$ 8,90");
});

test("moeda curta: fronteiras de mil e milhão", () => {
  assert.equal(formatCurrencyShort(999), "R$ 999,00");
  assert.equal(formatCurrencyShort(1000), "R$ 1 mil");
  assert.equal(formatCurrencyShort(12300), "R$ 12,3 mil");
  assert.equal(formatCurrencyShort(999_999), "R$ 1.000 mil");
  assert.equal(formatCurrencyShort(1_000_000), "R$ 1 mi");
  assert.equal(formatCurrencyShort(1_240_000), "R$ 1,2 mi");
  assert.equal(formatCurrencyShort(-12300), "-R$ 12,3 mil");
});

test("inteiros", () => {
  assert.equal(formatInteger(1234567), "1.234.567");
  assert.equal(formatInteger(0), "0");
  assert.equal(formatIntegerShort(9999), "9.999");
  assert.equal(formatIntegerShort(15000), "15 mil");
  assert.equal(formatIntegerShort(2_500_000), "2,5 mi");
});

test("formatValue escolhe pelo tipo e pelo modo curto", () => {
  assert.equal(formatValue("currency", 12300), "R$ 12.300,00");
  assert.equal(formatValue("currency", 12300, true), "R$ 12,3 mil");
  assert.equal(formatValue("integer", 12300), "12.300");
});

test("participação", () => {
  assert.equal(formatShare(0.425), "42,5%");
  assert.equal(formatShare(1), "100%");
});
