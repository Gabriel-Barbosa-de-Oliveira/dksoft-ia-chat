import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FileDescriptorSchema } from "./file-descriptor.ts";

const ID = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const valid = {
  id: ID,
  conversationId: ID,
  resultId: ID,
  name: "contas.xlsx",
  format: "xlsx",
  mime: "application/octet-stream",
  sizeBytes: 10,
  rowCount: 2,
  includesChart: false,
  containsFullPersonalData: false,
  createdAt: "2026-10-31T21:30:15.000Z",
  expiresAt: "2026-10-31T22:00:15.000Z",
  downloadPath: `/conversations/${ID}/exports/${ID}`,
};

describe("FileDescriptorSchema (espelho)", () => {
  it("aceita um descritor válido", () => assert.ok(FileDescriptorSchema.safeParse(valid).success));
  it("recusa formato desconhecido", () => assert.ok(!FileDescriptorSchema.safeParse({ ...valid, format: "csv" }).success));
  it("recusa tamanho negativo", () => assert.ok(!FileDescriptorSchema.safeParse({ ...valid, sizeBytes: -1 }).success));
});
